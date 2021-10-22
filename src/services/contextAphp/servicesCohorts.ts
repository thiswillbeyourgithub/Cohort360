import moment from 'moment'

import {
  CohortData,
  SearchByTypes,
  VitalStatus,
  Back_API_Response,
  Cohort,
  AgeRepartitionType,
  GenderRepartitionType
} from 'types'
import { IPatient, IComposition, IComposition_Section, PatientGenderKind } from '@ahryman40k/ts-fhir-types/lib/R4'
import {
  getGenderRepartitionMapAphp,
  getEncounterRepartitionMapAphp,
  getAgeRepartitionMapAphp,
  getVisitRepartitionMapAphp
} from 'utils/graphUtils'
import { getApiResponseResources } from 'utils/apiHelpers'

import { fetchGroup, fetchPatient, fetchEncounter, fetchComposition, fetchCompositionContent } from './callApi'
import servicePatients from './servicePatients'

import apiBackend from '../apiBackend'
import apiPortail from '../apiPortail'

export interface IServicesCohorts {
  fetchCohort: (cohortId: string) => Promise<CohortData | undefined>

  fetchPatientList: (
    page: number,
    searchBy: SearchByTypes,
    searchInput: string,
    gender: PatientGenderKind,
    age: [number, number],
    vitalStatus: VitalStatus,
    sortBy: string,
    sortDirection: string,
    groupId?: string,
    includeFacets?: boolean
  ) => Promise<
    | {
        totalPatients: number
        originalPatients: IPatient[] | undefined
        agePyramidData?: AgeRepartitionType
        genderRepartitionMap?: GenderRepartitionType
      }
    | undefined
  >

  fetchDocuments: (
    deidentifiedBoolean: boolean,
    sortBy: string,
    sortDirection: string,
    page: number,
    searchInput: string,
    selectedDocTypes: string[],
    nda: string,
    startDate?: string | null,
    endDate?: string | null,
    groupId?: string,
    encounterIds?: string[]
  ) => Promise<{
    totalDocs: number
    totalAllDocs: number
    documentsList: IComposition[]
  }>

  fetchDocumentContent: (compositionId: string) => Promise<IComposition_Section[]>

  fetchCohortExportRight: (cohortId: string, providerId: string) => Promise<boolean>
  createExport: (args: {
    cohortId: number
    motivation: string
    tables: string[]
    output_format?: string
  }) => Promise<any>
}

const servicesCohorts: IServicesCohorts = {
  fetchCohort: async (cohortId) => {
    // eslint-disable-next-line
    let fetchCohortsResults = await Promise.all([
      apiBackend.get<Back_API_Response<Cohort>>(`/explorations/cohorts/?fhir_group_id=${cohortId}`),
      fetchGroup({ _id: cohortId }),
      fetchPatient({
        pivotFacet: ['age_gender', 'deceased_gender'],
        _list: [cohortId],
        size: 20,
        _sort: 'given',
        _elements: ['gender', 'name', 'birthDate', 'deceased', 'identifier', 'extension']
      }),
      fetchEncounter({
        facet: ['class', 'visit-year-month-gender-facet'],
        _list: [cohortId],
        size: 0,
        type: 'VISIT'
      })
    ])

    const cohortInfo = fetchCohortsResults[0]
    const cohortResp = fetchCohortsResults[1]
    const patientsResp = fetchCohortsResults[2]
    const encountersResp = fetchCohortsResults[3]

    let name = ''
    let description = ''
    let requestId = ''
    let uuid = ''
    let favorite = false

    if (cohortInfo.data.results && cohortInfo.data.results.length >= 1) {
      name = cohortInfo.data.results[0].name ?? ''
      description = cohortInfo.data.results[0].description ?? ''
      requestId = cohortInfo.data.results[0].request ?? ''
      favorite = cohortInfo.data.results[0].favorite ?? false
      uuid = cohortInfo.data.results[0].uuid ?? ''
    } else {
      throw new Error('This cohort is not your or invalid')
    }

    if (!name) {
      name = cohortResp.data.resourceType === 'Bundle' ? cohortResp.data.entry?.[0].resource?.name ?? '-' : '-'
    }

    const cohort = cohortResp.data.resourceType === 'Bundle' ? cohortResp.data.entry?.[0].resource : undefined

    const totalPatients = patientsResp.data.resourceType === 'Bundle' ? patientsResp.data.total : 0

    const originalPatients = getApiResponseResources(patientsResp)

    const agePyramidData =
      patientsResp.data.resourceType === 'Bundle'
        ? getAgeRepartitionMapAphp(
            patientsResp.data.meta?.extension?.find((facet: any) => facet.url === 'facet-age-month')?.extension
          )
        : undefined

    const genderRepartitionMap =
      patientsResp.data.resourceType === 'Bundle'
        ? getGenderRepartitionMapAphp(
            patientsResp.data.meta?.extension?.find((facet: any) => facet.url === 'facet-deceased')?.extension
          )
        : undefined

    const monthlyVisitData =
      encountersResp.data.resourceType === 'Bundle'
        ? getVisitRepartitionMapAphp(
            encountersResp.data.meta?.extension?.find(
              (facet: any) => facet.url === 'facet-visit-year-month-gender-facet'
            )?.extension
          )
        : undefined

    const visitTypeRepartitionData =
      encountersResp.data.resourceType === 'Bundle'
        ? getEncounterRepartitionMapAphp(
            encountersResp.data.meta?.extension?.find((facet: any) => facet.url === 'facet-class-simple')?.extension
          )
        : undefined

    return {
      name,
      description,
      cohort,
      totalPatients,
      originalPatients,
      genderRepartitionMap,
      visitTypeRepartitionData,
      agePyramidData,
      monthlyVisitData,
      requestId,
      favorite,
      uuid
    }
  },

  fetchPatientList: async (
    page,
    searchBy,
    searchInput,
    gender,
    age,
    vitalStatus,
    sortBy,
    sortDirection,
    groupId,
    includeFacets
  ) => {
    let _searchInput = ''
    const searches = searchInput
      .trim() // Remove space before/after search
      .split(' ') // Split by space (= ['mot1', 'mot2' ...])
      .filter((elem: string) => elem) // Filter if you have ['mot1', '', 'mot2'] (double space)
    for (const _search of searches) {
      _searchInput = _searchInput ? `${_searchInput} AND "${_search}"` : `"${_search}"`
    }

    let date1 = ''
    let date2 = ''
    if (age[0] !== 0 || age[1] !== 130) {
      date1 = moment()
        .subtract(age[1] + 1, 'years')
        .add(1, 'days')
        .format('YYYY-MM-DD') //`${today.getFullYear() - age[1]}-${monthStr}-${dayStr}`
      date2 = moment().subtract(age[0], 'years').format('YYYY-MM-DD') //`${today.getFullYear() - age[0]}-${monthStr}-${dayStr}`
    }

    const patientsResp = await fetchPatient({
      size: 20,
      offset: page ? (page - 1) * 20 : 0,
      _sort: sortBy,
      sortDirection: sortDirection === 'desc' ? 'desc' : 'asc',
      pivotFacet: includeFacets ? ['age_gender', 'deceased_gender'] : [],
      _list: groupId ? [groupId] : [],
      gender:
        gender === PatientGenderKind._unknown ? '' : gender === PatientGenderKind._other ? `other,unknown` : gender,
      searchBy,
      _text: _searchInput,
      minBirthdate: date1,
      maxBirthdate: date2,
      deceased: vitalStatus !== VitalStatus.all ? (vitalStatus === VitalStatus.deceased ? true : false) : undefined
    })

    const totalPatients = patientsResp.data.resourceType === 'Bundle' ? patientsResp.data.total : 0

    const originalPatients = getApiResponseResources(patientsResp)

    const agePyramidData =
      patientsResp.data.resourceType === 'Bundle'
        ? getAgeRepartitionMapAphp(
            patientsResp.data.meta?.extension?.filter((facet: any) => facet.url === 'facet-age-month')?.[0].extension
          )
        : undefined

    const genderRepartitionMap =
      patientsResp.data.resourceType === 'Bundle'
        ? getGenderRepartitionMapAphp(
            patientsResp.data.meta?.extension?.filter((facet: any) => facet.url === 'facet-deceased')?.[0].extension
          )
        : undefined

    return {
      totalPatients: totalPatients ?? 0,
      originalPatients,
      genderRepartitionMap,
      agePyramidData
    }
  },

  fetchDocuments: async (
    deidentifiedBoolean,
    sortBy,
    sortDirection,
    page,
    searchInput,
    selectedDocTypes,
    nda,
    startDate,
    endDate,
    groupId
  ) => {
    if (searchInput) {
      searchInput = searchInput
        .replaceAll('!', '%21')
        .replaceAll('#', '%23')
        .replaceAll('$', '%24')
        .replaceAll('&', '%26')
        .replaceAll("'", '%27')
        .replaceAll('(', '%28')
        .replaceAll(')', '%29')
        .replaceAll('*', '%2A')
        .replaceAll('+', '%2B')
        .replaceAll(',', '%2C')
        .replaceAll('/', '%2F')
        .replaceAll(':', '%3A')
        .replaceAll(';', '%3B')
        .replaceAll('=', '%3D')
        .replaceAll('?', '%3F')
        .replaceAll('@', '%40')
        .replaceAll('[', '%5B')
        .replaceAll(']', '%5D')
        .replaceAll('\n', '%20')
    }

    const [docsList, allDocsList] = await Promise.all([
      fetchComposition({
        size: 20,
        offset: page ? (page - 1) * 20 : 0,
        _sort: sortBy,
        sortDirection: sortDirection === 'desc' ? 'desc' : 'asc',
        status: 'final',
        _elements: searchInput ? [] : ['status', 'type', 'subject', 'encounter', 'date', 'title'],
        _list: groupId ? [groupId] : [],
        _text: searchInput,
        type: selectedDocTypes.length > 0 ? selectedDocTypes.join(',') : '',
        'encounter.identifier': nda,
        minDate: startDate ?? '',
        maxDate: endDate ?? ''
      }),
      !!searchInput ||
      !!selectedDocTypes ||
      !!nda ||
      (startDate ? [startDate, endDate ? endDate : ''] : endDate ? [endDate] : []).length > 0
        ? fetchComposition({
            status: 'final',
            _list: groupId ? [groupId] : [],
            size: 0
          })
        : null
    ])

    const totalDocs = docsList?.data?.resourceType === 'Bundle' ? docsList.data.total : 0
    const totalAllDocs =
      allDocsList !== null ? (allDocsList?.data?.resourceType === 'Bundle' ? allDocsList.data.total : 0) : totalDocs

    const documentsList = await servicePatients.getInfos(
      deidentifiedBoolean,
      getApiResponseResources(docsList),
      groupId
    )

    return {
      totalDocs: totalDocs ?? 0,
      totalAllDocs: totalAllDocs ?? 0,
      documentsList
    }
  },

  fetchDocumentContent: async (compositionId) => {
    const documentContent = await fetchCompositionContent(compositionId)
    return documentContent
  },

  fetchCohortExportRight: async (cohortId, providerId) => {
    try {
      const rightResponse = await fetchGroup({
        _list: [cohortId],
        provider: providerId
      })

      if (
        rightResponse &&
        // @ts-ignore
        rightResponse.data &&
        // @ts-ignore
        rightResponse.data.entry &&
        // @ts-ignore
        rightResponse.data.entry[0] &&
        // @ts-ignore
        rightResponse.data.entry[0].resource
      ) {
        //@ts-ignore
        const currentCohortItem = rightResponse.data.entry[0].resource.extension?.[0]
        const canMakeExport =
          currentCohortItem.extension && currentCohortItem.extension.length > 0
            ? currentCohortItem.extension.some(
                (extension: any) => extension.url === 'EXPORT_DATA_NOMINATIVE' && extension.valueString === 'true'
              ) &&
              currentCohortItem.extension.some(
                (extension: any) => extension.url === 'READ_DATA_NOMINATIVE' && extension.valueString === 'true'
              )
            : false
        return canMakeExport
      }
      return false
    } catch (error) {
      console.error('Error (fetchCohortExportRight) :', error)
      return false
    }
  },

  createExport: async (args) => {
    try {
      const { cohortId, motivation, tables, output_format = 'csv' } = args

      const exportResponse = await new Promise((resolve) => {
        resolve(
          apiPortail.post('/exports/', {
            cohort_id: cohortId,
            motivation,
            tables: tables.map((table: string) => ({
              omop_table_name: table
            })),
            output_format
          })
        )
      })
        .then((values) => {
          return values
        })
        .catch((error) => {
          return error
        })

      // @ts-ignore
      if (exportResponse && exportResponse && exportResponse.status !== 201) {
        // @ts-ignore
        return { error: exportResponse && exportResponse.response.data }
      } else {
        // @ts-ignore
        return exportResponse && exportResponse.data
      }
    } catch (error) {
      return { error }
    }
  }
}

export default servicesCohorts
