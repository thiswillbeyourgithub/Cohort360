import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

import { RootState } from 'state'

import {
  CohortEncounter,
  CohortObservation,
  IPatientDetails,
  IPatientDocuments,
  IPatientPmsi,
  IPatientMedication,
  IPatientObservation,
  SearchByTypes
} from 'types'

import { logout } from './me'

import services from 'services/aphp'
import servicesPerimeters from '../services/aphp/servicePerimeters'
import {
  Claim,
  Condition,
  DocumentReference,
  Encounter,
  Identifier,
  MedicationAdministration,
  MedicationRequest,
  Observation,
  Patient,
  Procedure
} from 'fhir/r4'

export type PatientState = null | {
  loading: boolean
  deidentified?: boolean
  patientInfo?: IPatientDetails
  hospits?: {
    loading: boolean
    list: (CohortEncounter | Encounter)[]
  }
  documents?: IPatientDocuments
  pmsi?: {
    diagnostic?: IPatientPmsi<Condition>
    ghm?: IPatientPmsi<Claim>
    ccam?: IPatientPmsi<Procedure>
  }
  medication?: {
    administration?: IPatientMedication<MedicationAdministration>
    prescription?: IPatientMedication<MedicationRequest>
  }
  biology?: IPatientObservation<CohortObservation>
}

/**
 * fetchPmsi
 *
 */
type FetchPmsiParams = {
  selectedTab: 'diagnostic' | 'ghm' | 'ccam'
  groupId?: string
  options?: {
    page?: number
    filters?: {
      searchInput: string
      nda: string
      code: string
      diagnosticTypes: string[]
      startDate: string | null
      endDate: string | null
    }
    sort?: {
      by: string
      direction: string
    }
  }
}
type FetchPmsiReturn =
  | { diagnostic: IPatientPmsi<Condition> }
  | { ghm: IPatientPmsi<Claim> }
  | { ccam: IPatientPmsi<Procedure> }
  | undefined
const fetchPmsi = createAsyncThunk<FetchPmsiReturn, FetchPmsiParams, { state: RootState }>(
  'patient/fetchPmsi',
  async ({ selectedTab, groupId, options }, { getState }) => {
    const patientState = getState().patient
    const currentPmsiState = patientState?.pmsi ? patientState?.pmsi[selectedTab] ?? { total: null } : { total: null }
    const WILDCARD = '*'

    const patientId = patientState?.patientInfo?.id ?? ''
    if (!patientId) {
      throw new Error('Patient Error: patient is required')
    }
    const deidentified = patientState?.deidentified ?? true
    const hospits = patientState?.hospits?.list ?? []

    const sortBy = options?.sort?.by ?? ''
    const sortDirection = options?.sort?.direction ?? ''
    const page = options?.page ?? 1
    const searchInput = options?.filters?.searchInput + WILDCARD ?? ''
    const code = options?.filters?.code ?? ''
    const diagnosticTypes = options?.filters?.diagnosticTypes ?? []
    const nda = options?.filters?.nda ?? ''
    const startDate = options?.filters?.startDate ?? null
    const endDate = options?.filters?.endDate ?? null

    const pmsiResponse = await services.patients.fetchPMSI(
      page,
      patientId,
      selectedTab,
      searchInput,
      nda,
      code,
      diagnosticTypes,
      sortBy,
      sortDirection,
      groupId,
      startDate,
      endDate
    )

    if (pmsiResponse.pmsiData === undefined) return undefined

    const pmsiList: any[] = linkElementWithEncounter(
      pmsiResponse.pmsiData as (Procedure | Condition | Claim)[],
      hospits,
      deidentified
    )

    const pmsiReturn = {
      loading: false,
      count: pmsiResponse.pmsiTotal ?? 0,
      total: currentPmsiState?.total ?? pmsiResponse.pmsiTotal ?? 0,
      list: pmsiList,
      page,
      options
    }

    switch (selectedTab) {
      case 'diagnostic':
        return { diagnostic: pmsiReturn as IPatientPmsi<Condition> }
      case 'ccam':
        return { ccam: pmsiReturn as IPatientPmsi<Procedure> }
      case 'ghm':
        return { ghm: pmsiReturn as IPatientPmsi<Claim> }
    }
  }
)

/**
 * fetchBiology
 *
 */
export type FetchBiologyParams = {
  groupId?: string
  rowStatus: boolean
  options?: {
    page?: number
    filters?: {
      searchInput: string
      nda: string
      loinc: string
      anabio: string
      startDate: string | null
      endDate: string | null
    }
    sort?: {
      by: string
      direction: string
    }
  }
}
type FetchBiologyReturn = undefined | { biology: IPatientObservation<CohortObservation> }
const fetchBiology = createAsyncThunk<FetchBiologyReturn, FetchBiologyParams, { state: RootState }>(
  'patient/fetchBiology',
  async ({ groupId, options, rowStatus }, { getState }) => {
    try {
      const patientState = getState().patient

      const patientId = patientState?.patientInfo?.id ?? ''
      if (!patientId) {
        throw new Error('Patient Error: patient is required')
      }

      const deidentified = patientState?.deidentified ?? true
      const hospits = patientState?.hospits?.list ?? []

      const sortBy = options?.sort?.by ?? ''
      const sortDirection = options?.sort?.direction ?? ''
      const page = options?.page ?? 1
      const searchInput = options?.filters?.searchInput ?? ''
      const nda = options?.filters?.nda ?? ''
      const loinc = options?.filters?.loinc ?? ''
      const anabio = options?.filters?.anabio ?? ''
      const startDate = options?.filters?.startDate ?? null
      const endDate = options?.filters?.endDate ?? null

      const biologyResponse = await services.patients.fetchObservation(
        sortBy,
        sortDirection,
        page,
        patientId,
        rowStatus,
        searchInput,
        nda,
        loinc,
        anabio,
        startDate,
        endDate,
        groupId
      )

      const biologyList: any[] = linkElementWithEncounter(biologyResponse.biologyList, hospits, deidentified)

      return {
        biology: {
          loading: false,
          count: biologyResponse.biologyTotal,
          total: patientState?.biology?.total ? patientState?.biology?.total : biologyResponse.biologyTotal,
          list: biologyList,
          page,
          options
        } as IPatientObservation<CohortObservation>
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la biologie', error)
      throw error
    }
  }
)

/**
 * fetchMedication
 *
 */
type FetchMedicationParams = {
  selectedTab: 'prescription' | 'administration'
  groupId?: string
  options?: {
    page?: number
    filters?: {
      searchInput: string
      nda: string
      selectedPrescriptionTypes: { id: string; label: string }[]
      selectedAdministrationRoutes: { id: string; label: string }[]
      startDate: string | null
      endDate: string | null
    }
    sort?: {
      by: string
      direction: string
    }
  }
}
type FetchMedicationReturn =
  | { prescription: IPatientMedication<MedicationRequest> }
  | { administration: IPatientMedication<MedicationAdministration> }
  | undefined
const fetchMedication = createAsyncThunk<FetchMedicationReturn, FetchMedicationParams, { state: RootState }>(
  'patient/fetchMedication',
  async ({ selectedTab, groupId, options }, { getState }) => {
    const patientState = getState().patient
    const currentMedicationState = patientState?.medication
      ? patientState?.medication[selectedTab] ?? { total: null }
      : { total: null }

    const patientId = patientState?.patientInfo?.id ?? ''
    if (!patientId) {
      throw new Error('Patient Error: patient is required')
    }
    const deidentified = patientState?.deidentified ?? true
    const hospits = patientState?.hospits?.list ?? []

    const sortBy = options?.sort?.by ?? ''
    const sortDirection = options?.sort?.direction ?? ''
    const page = options?.page ?? 1
    const searchInput = options?.filters?.searchInput ?? ''
    const prescriptionTypes = options?.filters?.selectedPrescriptionTypes?.map(({ id }) => id).join(',') ?? ''
    const administrationRoutes = options?.filters?.selectedAdministrationRoutes?.map(({ id }) => id).join(',') ?? ''
    const nda = options?.filters?.nda ?? ''
    const startDate = options?.filters?.startDate ?? null
    const endDate = options?.filters?.endDate ?? null

    const medicationResponse = await services.patients.fetchMedication(
      page,
      patientId,
      selectedTab,
      sortBy,
      sortDirection,
      searchInput,
      nda,
      prescriptionTypes,
      administrationRoutes,
      groupId,
      startDate ? startDate : undefined,
      endDate ? endDate : undefined
    )

    if (medicationResponse.medicationData === undefined) return undefined

    const medicationList: any[] = linkElementWithEncounter(
      medicationResponse.medicationData as (MedicationRequest | MedicationAdministration)[],
      hospits,
      deidentified
    )

    const medicationReturn = {
      loading: false,
      count: medicationResponse.medicationTotal ?? 0,
      total: currentMedicationState?.total ?? medicationResponse.medicationTotal ?? 0,
      list: medicationList,
      page,
      options
    }

    switch (selectedTab) {
      case 'prescription':
        return { prescription: medicationReturn as IPatientMedication<MedicationRequest> }
      case 'administration':
        return { administration: medicationReturn as IPatientMedication<MedicationAdministration> }
    }
  }
)

/**
 * fetchDocument
 *
 */
type FetchDocumentsParams = {
  signal?: AbortSignal
  groupId?: string
  options?: {
    page?: number
    searchBy?: SearchByTypes
    filters?: {
      searchInput: string
      nda: string
      selectedDocTypes: string[]
      startDate: string | null
      endDate: string | null
      onlyPdfAvailable: boolean
    }
    sort?: {
      by: string
      direction: string
    }
  }
}
type FetchDocumentsReturn = { documents?: IPatientDocuments } | undefined
const fetchDocuments = createAsyncThunk<FetchDocumentsReturn, FetchDocumentsParams, { state: RootState }>(
  'patient/fetchDocuments',
  async ({ signal, groupId, options }, { getState }) => {
    try {
      const patientState = getState().patient

      const patientId = patientState?.patientInfo?.id ?? ''
      if (!patientId) {
        throw new Error('Patient Error: patient is required')
      }
      const deidentified = patientState?.deidentified ?? true
      const hospits = patientState?.hospits?.list ?? []

      const sortBy = options?.sort?.by ?? ''
      const sortDirection = options?.sort?.direction ?? ''
      const page = options?.page ?? 1
      const searchInput = options?.filters?.searchInput ?? ''
      const searchBy = options?.searchBy ?? SearchByTypes.text
      const selectedDocTypes = options?.filters?.selectedDocTypes ?? []
      const nda = options?.filters?.nda ?? ''
      const startDate = options?.filters?.startDate ?? null
      const endDate = options?.filters?.endDate ?? null
      const onlyPdfAvailable = options?.filters?.onlyPdfAvailable ?? false

      if (searchInput) {
        const searchInputError = await services.cohorts.checkDocumentSearchInput(searchInput, signal)

        if (searchInputError && searchInputError.isError) {
          return {
            documents: {
              loading: false,
              count: 0,
              total: 0,
              list: [],
              page: 1,
              options,
              searchInputError: searchInputError
            } as IPatientDocuments
          }
        }
      }

      const documentsResponse = await services.patients.fetchDocuments(
        sortBy,
        sortDirection,
        searchBy,
        page,
        patientId,
        searchInput,
        selectedDocTypes,
        nda,
        onlyPdfAvailable,
        startDate,
        endDate,
        groupId,
        signal
      )

      const documentsList: any[] = linkElementWithEncounter(
        documentsResponse.docsList as DocumentReference[],
        hospits,
        deidentified
      )

      return {
        documents: {
          loading: false,
          count: documentsResponse.docsTotal,
          total: patientState?.documents?.total ? patientState?.documents?.total : documentsResponse.docsTotal,
          list: documentsList,
          page,
          options
        } as IPatientDocuments
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }
)

/**
 * fetchAllProcedure
 *
 */
type FetchAllProceduresParams = {
  patientId: string
  groupId?: string
}
type FetchAllProceduresReturn =
  | {
      ccam?: IPatientPmsi<Procedure>
      diagnostic?: IPatientPmsi<Condition>
    }
  | undefined
const fetchAllProcedures = createAsyncThunk<FetchAllProceduresReturn, FetchAllProceduresParams, { state: RootState }>(
  'patient/fetchAllProcedures',
  async ({ patientId, groupId }, { getState }) => {
    try {
      const patientState = getState().patient

      const deidentified = patientState?.deidentified ?? true
      const hospits = patientState?.hospits?.list ?? []
      // CCAM Variables:
      const ccamTotal = patientState?.pmsi?.ccam?.total ?? 0
      let ccamCount = patientState?.pmsi?.ccam?.list.length ?? 0

      // CIM10 Variables:
      const diagnosticTotal = patientState?.pmsi?.diagnostic?.total ?? 0
      let diagnosticCount = patientState?.pmsi?.diagnostic?.list.length ?? 0

      // API Calls:
      const [ccamResponses, diagnosticResponses] = await Promise.all([
        ccamTotal - ccamCount !== 0
          ? services.patients.fetchAllProcedures(patientId, groupId ?? '', ccamTotal - ccamCount)
          : null,
        diagnosticTotal - diagnosticCount !== 0
          ? services.patients.fetchAllConditions(patientId, groupId ?? '', diagnosticTotal - diagnosticCount)
          : null
      ])

      // CCAM List:
      let ccamList: Procedure[] = ccamResponses
        ? linkElementWithEncounter(ccamResponses as Procedure[], hospits, deidentified)
        : []
      // eslint-disable-next-line no-unsafe-optional-chaining
      ccamList = patientState?.pmsi?.ccam?.list ? [...patientState?.pmsi?.ccam?.list, ...ccamList] : ccamList
      ccamCount = ccamList.length

      // CIM10 List:
      let diagnosticList: Condition[] = diagnosticResponses
        ? linkElementWithEncounter(diagnosticResponses as Condition[], hospits, deidentified)
        : []
      diagnosticList = patientState?.pmsi?.diagnostic?.list
        ? // eslint-disable-next-line no-unsafe-optional-chaining
          [...patientState?.pmsi?.diagnostic?.list, ...diagnosticList]
        : diagnosticList
      diagnosticCount = diagnosticList.length

      return {
        ccam: {
          loading: false,
          count: ccamCount,
          total: ccamTotal ?? ccamCount,
          list: ccamList,
          page: 1
        },
        diagnostic: {
          loading: false,
          count: diagnosticCount,
          total: diagnosticTotal ?? diagnosticCount,
          list: diagnosticList,
          page: 1
        }
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }
)

/**
 * fetchLastPmsi
 *
 */
type FetchLastPmsiParams = {
  patientId: string
  groupId?: string
}
type FetchLastPmsiReturn = {
  patientInfo: {
    lastGhm?: Claim | 'loading'
    lastProcedure?: Procedure | 'loading'
    mainDiagnosis?: Condition[] | 'loading'
  }
  pmsi?: {
    diagnostic?: IPatientPmsi<Condition>
    ghm?: IPatientPmsi<Claim>
    ccam?: IPatientPmsi<Procedure>
  }
} | null

const fetchLastPmsiInfo = createAsyncThunk<FetchLastPmsiReturn, FetchLastPmsiParams, { state: RootState }>(
  'patient/fetchLastPmsiInfo',
  async ({ patientId, groupId }, { getState }) => {
    try {
      const patientState = getState().patient

      const hospits = patientState?.hospits?.list ?? []
      const deidentified = patientState?.deidentified ?? []

      const fetchPatientResponse = await Promise.all([
        services.patients.fetchPMSI(0, patientId, 'diagnostic', '', '', '', [], 'recorded-date', 'desc', groupId),
        services.patients.fetchPMSI(0, patientId, 'ccam', '', '', '', [], 'date', 'desc', groupId),
        services.patients.fetchPMSI(0, patientId, 'ghm', '', '', '', [], 'created', 'desc', groupId)
      ])

      if (fetchPatientResponse === undefined) return null

      const diagnosticList = linkElementWithEncounter(
        fetchPatientResponse[0].pmsiData as Condition[],
        hospits,
        deidentified
      )
      const ccamList = linkElementWithEncounter(fetchPatientResponse[1].pmsiData as Procedure[], hospits, deidentified)
      const ghmList = linkElementWithEncounter(fetchPatientResponse[2].pmsiData as Claim[], hospits, deidentified)

      return {
        patientInfo: {
          lastGhm: ghmList ? (ghmList[0] as Claim) : undefined,
          lastProcedure: ccamList ? (ccamList[0] as Procedure) : undefined,
          mainDiagnosis: diagnosticList.filter(
            (diagnostic: any) => diagnostic.extension?.[0].valueString === 'dp'
          ) as Condition[]
        },
        pmsi: {
          diagnostic: {
            loading: false,
            count: fetchPatientResponse[0].pmsiTotal ?? 0,
            total: fetchPatientResponse[0].pmsiTotal ?? 0,
            list: diagnosticList,
            page: 1
          },
          ccam: {
            loading: false,
            count: fetchPatientResponse[1].pmsiTotal ?? 0,
            total: fetchPatientResponse[1].pmsiTotal ?? 0,
            list: ccamList,
            page: 1
          },
          ghm: {
            loading: false,
            count: fetchPatientResponse[2].pmsiTotal ?? 0,
            total: fetchPatientResponse[2].pmsiTotal ?? 0,
            list: ghmList,
            page: 1
          }
        }
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }
)

/**
 * fetchPatientInfo
 *
 */
type FetchPatientParams = {
  patientId: string
  groupId?: string
}
type FetchPatientReturn = {
  patientInfo: Patient & {
    lastEncounter?: Encounter
  }
  deidentified?: boolean
  hospits?: {
    loading: boolean
    list: (CohortEncounter | Encounter)[]
  }
} | null

const fetchPatientInfo = createAsyncThunk<FetchPatientReturn, FetchPatientParams, { state: RootState }>(
  'patient/fetchPatientInfo',
  async ({ patientId, groupId }, { getState, dispatch }) => {
    try {
      const patientState = getState().patient

      if (patientState && patientState.patientInfo && patientState.patientInfo.id === patientId) {
        return {
          patientInfo: patientState.patientInfo,
          deidentified: patientState.deidentified,
          hospits: patientState.hospits
        }
      }

      const fetchPatientResponse = await services.patients.fetchPatientInfo(patientId, groupId)
      if (fetchPatientResponse === undefined) return null

      const { patientInfo, hospits } = fetchPatientResponse
      let deidentifiedBoolean = true

      if (groupId) {
        deidentifiedBoolean = (await services.patients.fetchRights(groupId)) ?? {}
      } else {
        const perimeters = await services.perimeters.getPerimeters()
        deidentifiedBoolean = perimeters.some(
          (perimeter) => servicesPerimeters.getAccessFromScope(perimeter) === 'Pseudonymisé'
        )
      }
      if (
        patientState?.patientInfo?.id !== patientId ||
        !patientState?.patientInfo?.lastGhm ||
        patientState?.patientInfo?.lastGhm === 'loading' ||
        !patientState?.patientInfo?.lastProcedure ||
        patientState?.patientInfo?.lastProcedure === 'loading' ||
        !patientState?.patientInfo?.mainDiagnosis ||
        patientState?.patientInfo?.mainDiagnosis === 'loading'
      ) {
        dispatch(fetchLastPmsiInfo({ patientId, groupId }))
      }

      return {
        patientInfo,
        deidentified: deidentifiedBoolean,
        hospits: {
          loading: false,
          list: hospits ?? []
        }
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }
)

const patientSlice = createSlice({
  name: 'patient',
  initialState: null as PatientState,
  reducers: {
    clearPatient: () => {
      return null
    }
  },
  extraReducers: (builder) => {
    builder.addCase(logout.fulfilled, () => null)
    // fetchPatientInfo
    builder.addCase(fetchPatientInfo.pending, (state) =>
      state === null
        ? {
            loading: true,
            patientInfo: {
              resourceType: 'Patient',
              lastGhm: 'loading',
              lastProcedure: 'loading',
              mainDiagnosis: 'loading'
            }
          }
        : {
            ...state,
            loading: true,
            patientInfo: state.patientInfo
              ? state.patientInfo
              : {
                  resourceType: 'Patient'
                }
          }
    )
    builder.addCase(fetchPatientInfo.fulfilled, (state, action) =>
      action.payload === null
        ? null
        : action.payload.patientInfo.id === state?.patientInfo?.id
        ? {
            ...state,
            loading: false,
            deidentified: action.payload.deidentified,
            patientInfo: {
              ...(state?.patientInfo ?? {}),
              ...action.payload.patientInfo
            },
            hospits: action.payload.hospits
          }
        : {
            ...state,
            loading: false,
            deidentified: action.payload.deidentified,
            patientInfo: {
              ...state?.patientInfo,
              ...action.payload.patientInfo
            },
            hospits: action.payload.hospits,
            documents: undefined,
            pmsi: undefined,
            medication: {
              administration: {
                loading: false,
                count: 0,
                total: null,
                list: [],
                page: 0
              },
              prescription: {
                loading: false,
                count: 0,
                total: null,
                list: [],
                page: 0
              }
            },
            biology: undefined
          }
    )
    builder.addCase(fetchPatientInfo.rejected, () => null)
    builder.addCase(fetchLastPmsiInfo.pending, (state) =>
      state === null
        ? {
            loading: true,
            patientInfo: {
              resourceType: 'Patient',
              lastGhm: 'loading',
              lastProcedure: 'loading',
              mainDiagnosis: 'loading'
            }
          }
        : {
            ...state,
            loading: true,
            patientInfo: state.patientInfo
              ? { ...state.patientInfo, lastGhm: 'loading', lastProcedure: 'loading', mainDiagnosis: 'loading' }
              : {
                  resourceType: 'Patient',
                  lastGhm: 'loading',
                  lastProcedure: 'loading',
                  mainDiagnosis: 'loading'
                }
          }
    )
    builder.addCase(fetchLastPmsiInfo.fulfilled, (state, action) =>
      action.payload === null
        ? null
        : {
            ...state,
            loading: false,
            patientInfo: state?.patientInfo
              ? {
                  ...state?.patientInfo,
                  ...action.payload.patientInfo
                }
              : {
                  resourceType: 'Patient',
                  ...action.payload.patientInfo
                },
            pmsi: action.payload.pmsi
          }
    )
    builder.addCase(fetchLastPmsiInfo.rejected, (state) => ({
      ...state,
      loading: false,
      patientInfo: state?.patientInfo
        ? {
            ...state?.patientInfo,
            lastGhm: undefined,
            lastProcedure: undefined,
            mainDiagnosis: undefined
          }
        : {
            resourceType: 'Patient',
            lastGhm: undefined,
            lastProcedure: undefined,
            mainDiagnosis: undefined
          },
      pmsi: {
        ccam: {
          loading: false,
          count: 0,
          total: 0,
          list: [],
          page: 0
        },
        diagnostics: {
          loading: false,
          count: 0,
          total: 0,
          list: [],
          page: 0
        },
        ghm: {
          loading: false,
          count: 0,
          total: 0,
          list: [],
          page: 0
        }
      }
    }))
    builder.addCase(fetchAllProcedures.pending, (state) =>
      state === null
        ? null
        : {
            ...state,
            pmsi: state.pmsi
              ? {
                  ...state.pmsi,
                  ccam: state.pmsi.ccam
                    ? {
                        ...state.pmsi.ccam,
                        loading: true
                      }
                    : undefined,
                  diagnostic: state.pmsi.diagnostic
                    ? {
                        ...state.pmsi.diagnostic,
                        loading: true
                      }
                    : undefined
                }
              : undefined
          }
    )
    builder.addCase(fetchAllProcedures.fulfilled, (state, action) =>
      action.payload === undefined
        ? null
        : {
            ...state,
            loading: false,
            pmsi: state?.pmsi
              ? {
                  ...state?.pmsi,
                  ccam: action.payload.ccam,
                  diagnostic: action.payload.diagnostic
                }
              : {
                  ccam: action.payload.ccam,
                  diagnostic: action.payload.diagnostic
                }
          }
    )
    builder.addCase(fetchAllProcedures.rejected, (state) => ({
      ...state,
      loading: false,
      pmsi: {
        ccam: {
          loading: false,
          count: 0,
          total: 0,
          list: [],
          page: 0
        },
        diagnostics: {
          loading: false,
          count: 0,
          total: 0,
          list: [],
          page: 0
        }
      }
    }))
    builder.addCase(fetchDocuments.pending, (state) =>
      state === null
        ? null
        : {
            ...state,
            documents: state.documents
              ? {
                  ...state.documents,
                  loading: true
                }
              : undefined
          }
    )
    builder.addCase(fetchDocuments.fulfilled, (state, action) =>
      action.payload === undefined
        ? null
        : {
            ...state,
            loading: false,
            documents: action.payload.documents ?? undefined
          }
    )
    builder.addCase(fetchDocuments.rejected, (state) => ({
      ...state,
      loading: false
    }))
    builder.addCase(fetchPmsi.pending, (state) =>
      state === null
        ? null
        : {
            ...state,
            pmsi: state.pmsi
              ? {
                  ...state.pmsi,
                  diagnostic: state.pmsi.diagnostic
                    ? {
                        ...state.pmsi.diagnostic,
                        loading: true
                      }
                    : undefined,
                  ccam: state.pmsi.ccam
                    ? {
                        ...state.pmsi.ccam,
                        loading: true
                      }
                    : undefined,
                  ghm: state.pmsi.ghm
                    ? {
                        ...state.pmsi.ghm,
                        loading: true
                      }
                    : undefined
                }
              : {
                  diagnostic: undefined,
                  ccam: undefined,
                  ghm: undefined
                }
          }
    )
    builder.addCase(fetchPmsi.fulfilled, (state, action) =>
      action.payload === undefined || state === null
        ? null
        : {
            ...state,
            loading: false,
            pmsi: state.pmsi
              ? {
                  ...state.pmsi,
                  ...action.payload
                }
              : undefined
          }
    )
    builder.addCase(fetchPmsi.rejected, (state) => ({
      ...state,
      loading: false,
      pmsi: {
        diagnostic: {
          loading: false,
          count: 0,
          total: 0,
          list: [],
          page: 0
        },
        ghm: {
          loading: false,
          count: 0,
          total: 0,
          list: [],
          page: 0
        },
        ccam: {
          loading: false,
          count: 0,
          total: 0,
          list: [],
          page: 0
        }
      }
    }))
    builder.addCase(fetchMedication.rejected, (state) => ({
      ...state,
      loading: false,
      medication: {
        administration: {
          loading: false,
          count: 0,
          total: 0,
          list: [],
          page: 0
        },
        prescription: {
          loading: false,
          count: 0,
          total: 0,
          list: [],
          page: 0
        }
      }
    }))
    builder.addCase(fetchMedication.pending, (state) =>
      state === null
        ? null
        : {
            ...state,
            medication: state.medication
              ? {
                  ...state.medication,
                  administration: state.medication.administration
                    ? {
                        ...state.medication.administration,
                        loading: true
                      }
                    : undefined,
                  prescription: state.medication.prescription
                    ? {
                        ...state.medication.prescription,
                        loading: true
                      }
                    : undefined
                }
              : {
                  administration: undefined,
                  prescription: undefined
                }
          }
    )
    builder.addCase(fetchMedication.fulfilled, (state, action) =>
      action.payload === undefined || state === null
        ? null
        : {
            ...state,
            loading: false,
            medication: state.medication
              ? {
                  ...state.medication,
                  ...action.payload
                }
              : undefined
          }
    )
    builder.addCase(fetchBiology.rejected, (state) => ({
      ...state,
      loading: false,
      biology: {
        loading: false,
        count: 0,
        total: 0,
        list: [],
        page: 0
      }
    }))
    builder.addCase(fetchBiology.pending, (state) =>
      state === null
        ? null
        : {
            ...state,
            biology: state.biology
              ? {
                  ...state.biology,
                  loading: true
                }
              : {
                  loading: true,
                  count: 0,
                  total: 0,
                  list: [],
                  page: 1
                }
          }
    )
    builder.addCase(fetchBiology.fulfilled, (state, action) =>
      action.payload === undefined
        ? null
        : {
            ...state,
            loading: false,
            biology: action.payload?.biology
          }
    )
  }
})

export default patientSlice.reducer
export {
  fetchPatientInfo,
  fetchLastPmsiInfo,
  fetchAllProcedures,
  fetchDocuments,
  fetchPmsi,
  fetchMedication,
  fetchBiology
}
export const { clearPatient } = patientSlice.actions

function linkElementWithEncounter<
  T extends
    | Procedure
    | Condition
    | Claim
    | DocumentReference
    | MedicationRequest
    | MedicationAdministration
    | Observation
>(elementEntries: T[], encounterList: any[], deidentifiedBoolean: any) {
  let elementList: (T & {
    serviceProvider?: string
    NDA?: string
    documents?: any[]
  })[] = []

  for (const entry of elementEntries) {
    let newElement = entry as T & {
      serviceProvider?: string
      NDA?: string
      documents?: any[]
    }

    let encounterId = ''
    // @ts-ignore
    switch (entry.resourceType) {
      case 'Claim':
        encounterId = (entry as Claim).item?.[0].encounter?.[0].reference?.replace(/^Encounter\//, '') ?? ''
        break
      case 'Procedure':
      case 'Condition':
        encounterId = (entry as Procedure | Condition).encounter?.reference?.replace(/^Encounter\//, '') ?? ''
        break
      case 'DocumentReference':
        encounterId = (entry as DocumentReference).context?.encounter?.[0].reference?.replace(/^Encounter\//, '') ?? ''
        break
      case 'MedicationRequest':
        encounterId = (entry as MedicationRequest).encounter?.reference?.replace(/^Encounter\//, '') ?? ''
        break
      case 'MedicationAdministration':
        encounterId = (entry as MedicationAdministration).context?.reference?.replace(/^Encounter\//, '') ?? ''
        break
      case 'Observation':
        encounterId = (entry as Observation).encounter?.reference?.replace(/^Encounter\//, '') ?? ''
        break
    }

    const foundEncounter = encounterList.find(({ id }) => id === encounterId) || null
    const foundEncounterWithDetails =
      // @ts-ignore
      encounterList.find(({ details }) => details?.find(({ id }) => id === encounterId)) || null

    newElement = fillElementInformation(
      deidentifiedBoolean,
      newElement,
      foundEncounterWithDetails ?? foundEncounter,
      encounterId,
      newElement.resourceType
    )

    elementList = [...elementList, newElement]
  }

  return elementList
}

function fillElementInformation<
  T extends
    | Procedure
    | Condition
    | Claim
    | DocumentReference
    | MedicationRequest
    | MedicationAdministration
    | Observation
>(deidentifiedBoolean: boolean, element: T, encounter: any, encounterId: string, resourceType: string) {
  const newElement = element as T & {
    serviceProvider?: string
    NDA?: string
    documents?: any[]
  }

  const encounterIsDetailed = encounter?.id !== encounterId

  if (!encounterIsDetailed) {
    newElement.serviceProvider = encounter?.serviceProvider?.display ?? 'Non renseigné'
  } else {
    const foundEncounterDetail =
      // @ts-ignore
      encounter?.details?.find(({ id }) => id === encounterId) ?? encounter
    newElement.serviceProvider = foundEncounterDetail?.serviceProvider?.display ?? 'Non renseigné'
  }

  newElement.NDA = encounter?.id ?? 'Inconnu'

  if (!deidentifiedBoolean && encounter?.identifier) {
    const nda = encounter.identifier.find((identifier: Identifier) => identifier.type?.coding?.[0].code === 'NDA')
    if (nda) {
      newElement.NDA = nda?.value ?? 'Inconnu'
    }
  }

  if (resourceType !== 'DocumentReference' && encounter?.documents && encounter.documents.length > 0) {
    newElement.documents = encounter.documents
  }

  return newElement
}
