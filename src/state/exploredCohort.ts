import { Cohort, CohortData } from 'types'
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { login, logout } from './me'
import { RootState } from 'state'

import { ODD_EXPORT } from '../constants'

import services from 'services/aphp'
import servicesPerimeters from '../services/aphp/servicePerimeters'
import { GroupMember } from 'fhir/r4'

export type ExploredCohortState = {
  importedPatients: any[]
  includedPatients: any[]
  excludedPatients: any[]
  loading: boolean
  rightToExplore: boolean | undefined
  requestId?: string
  cohortId?: string
  canMakeExport?: boolean
  deidentifiedBoolean?: boolean
} & CohortData

const defaultInitialState = {
  // CohortData
  name: '',
  description: '',
  cohort: undefined,
  totalPatients: undefined,
  originalPatients: [],
  totalDocs: 0,
  documentsList: [],
  wordcloudData: [],

  encounters: [],
  genderRepartitionMap: undefined,
  visitTypeRepartitionData: undefined,
  monthlyVisitData: undefined,
  agePyramidData: undefined,
  requestId: '',
  cohortId: '',
  favorite: false,
  // ExploredCohortState
  importedPatients: [],
  includedPatients: [],
  excludedPatients: [],
  loading: false,
  rightToExplore: undefined,
  canMakeExport: false,
  deidentifiedBoolean: undefined
}

const favoriteExploredCohort = createAsyncThunk<CohortData, { exploredCohort: Cohort }, { state: RootState }>(
  'exploredCohort/favoriteExploredCohort',
  async ({ exploredCohort }, { getState }) => {
    const state = getState()

    const favoriteResult = await services.projects.editCohort({ ...exploredCohort, favorite: !exploredCohort.favorite })

    return {
      ...state.exploredCohort,
      favorite: favoriteResult.favorite
    }
  }
)

const fetchExploredCohort = createAsyncThunk<
  CohortData,
  { context: 'patients' | 'cohort' | 'perimeters' | 'new_cohort'; id?: string; forceReload?: boolean },
  { state: RootState }
>('exploredCohort/fetchExploredCohort', async ({ context, id, forceReload }, { getState, dispatch }) => {
  const state = getState()
  const stateCohort = state.exploredCohort.cohort

  let shouldRefreshData = true

  switch (context) {
    case 'cohort': {
      shouldRefreshData = !stateCohort || Array.isArray(stateCohort) || stateCohort.id !== id
      break
    }
    case 'perimeters': {
      if (!id) {
        throw new Error('No given perimeter ids')
      }
      const perimeterIds = id.split(',')
      const statePerimeterIds =
        stateCohort &&
        Array.isArray(stateCohort) &&
        (stateCohort.map((group) => group.id).filter((id) => id !== undefined) as string[])

      shouldRefreshData =
        !statePerimeterIds ||
        statePerimeterIds.length !== perimeterIds.length ||
        statePerimeterIds.some((id) => !perimeterIds.includes(id))
      break
    }
    case 'patients': {
      shouldRefreshData = stateCohort !== undefined && state.exploredCohort.originalPatients !== undefined
      break
    }

    default:
      break
  }
  const fetchCohortAction = dispatch(fetchExploredCohortInBackground({ context, id }))
  if (shouldRefreshData || forceReload) {
    return await fetchCohortAction.unwrap()
  }
  return state.exploredCohort
})

const fetchExploredCohortInBackground = createAsyncThunk<
  CohortData,
  { context: 'patients' | 'cohort' | 'perimeters' | 'new_cohort'; id?: string },
  { state: RootState }
>('exploredCohort/fetchExploredCohortInBackground', async ({ context, id }, { getState }) => {
  const state = getState()

  let cohort
  switch (context) {
    case 'cohort': {
      if (id) {
        cohort = (await services.cohorts.fetchCohort(id)) as ExploredCohortState
        if (cohort) {
          cohort.cohortId = id
          const cohortRights = await services.cohorts.fetchCohortsRights([{ fhir_group_id: id }])
          if (cohortRights?.[0].rights) {
            if (
              cohortRights?.[0]?.rights?.read_patient_pseudo === false &&
              cohortRights?.[0]?.rights?.read_patient_nomi === false
            ) {
              throw new Error("You don't have any rights on this cohort")
            } else {
              cohort.canMakeExport = !!ODD_EXPORT ? cohortRights?.[0]?.rights?.export_csv_nomi : false

              cohort.deidentifiedBoolean = cohortRights?.[0]?.rights?.read_patient_pseudo
                ? cohortRights?.[0]?.rights?.read_patient_nomi
                  ? false
                  : true
                : false
            }
          } else {
            throw new Error("You don't have any rights on this cohort")
          }
        }
      }
      break
    }
    case 'patients': {
      cohort = (await services.patients.fetchMyPatients()) as ExploredCohortState
      const perimeters = await services.perimeters.getPerimeters()
      if (cohort) {
        cohort.name = '-'
        cohort.description = ''
        cohort.requestId = ''
        cohort.favorite = false
        cohort.uuid = ''
        cohort.canMakeExport = false
        cohort.deidentifiedBoolean = perimeters.some(
          (perimeter) => servicesPerimeters.getAccessFromScope(perimeter) === 'Pseudonymisé'
        )
      }
      break
    }
    case 'perimeters': {
      if (id) {
        cohort = (await services.perimeters.fetchPerimetersInfos(id)) as ExploredCohortState
        if (cohort) {
          cohort.name = '-'
          cohort.description = ''
          cohort.requestId = ''
          cohort.favorite = false
          cohort.uuid = ''
          cohort.canMakeExport = false
          cohort.deidentifiedBoolean =
            cohort.cohort && cohort.cohort && Array.isArray(cohort.cohort)
              ? cohort.cohort.some((cohort) =>
                  cohort.extension?.some(
                    ({ url, valueString }) => url === 'READ_ACCESS' && valueString === 'DATA_PSEUDOANONYMISED'
                  )
                ) ?? true
              : true
        }
      }
      break
    }

    default:
      break
  }
  return cohort ?? state.exploredCohort
})

const exploredCohortSlice = createSlice({
  name: 'exploredCohort',
  initialState: defaultInitialState as ExploredCohortState,
  reducers: {
    addImportedPatients: (state: ExploredCohortState, action: PayloadAction<any[]>) => {
      const importedPatients = [...state.importedPatients, ...action.payload]
      state.importedPatients = importedPatients.filter(
        (patient, index, self) =>
          index === self.findIndex((t) => t.id === patient.id) &&
          !state.originalPatients?.map((p) => p.id).includes(patient.id) &&
          !state.excludedPatients.map((p) => p.id).includes(patient.id)
      )
    },
    removeImportedPatients: (state: ExploredCohortState, action: PayloadAction<any[]>) => {
      const listId = action.payload.map((patient) => patient.id)
      state.importedPatients = state.importedPatients.filter((patient) => !listId.includes(patient.id))
    },
    includePatients: (state: ExploredCohortState, action: PayloadAction<any[]>) => {
      const includedPatients = [...state.includedPatients, ...action.payload]
      state.importedPatients = state.importedPatients.filter(
        (patient) => !action.payload.map((p) => p.id).includes(patient.id)
      )
      state.includedPatients = includedPatients
    },
    excludePatients: (state: ExploredCohortState, action: PayloadAction<any[]>) => {
      const toExcluded = state.originalPatients?.filter((patient) =>
        action.payload.map((p) => p.id).includes(patient.id)
      )
      const toImported = state.includedPatients.filter((patient) =>
        action.payload.map((p) => p.id).includes(patient.id)
      )
      const allExcludedPatients = toExcluded ? [...state.excludedPatients, ...toExcluded] : []
      const allImportedPatients = toImported ? [...state.importedPatients, ...toImported] : []
      return {
        ...state,
        includedPatients: state.includedPatients.filter(
          (patient) => !action.payload.map((p) => p.id).includes(patient.id)
        ),
        originalPatients: state.originalPatients?.filter(
          (patient) => !action.payload.map((p) => p.id).includes(patient.id)
        ),
        excludedPatients: allExcludedPatients.filter(
          (patient, index, self) => index === self.findIndex((t) => t.id === patient.id)
        ),
        importedPatients: allImportedPatients
      }
    },
    removeExcludedPatients: (state: ExploredCohortState, action: PayloadAction<any[]>) => {
      if (!action || !action.payload) return
      const statePatient = state.originalPatients || []
      const originalPatients = [...statePatient, ...action.payload]
      const excludedPatients = state.excludedPatients.filter(
        (patient) => !action.payload.map((p) => p.id).includes(patient.id)
      )
      state.originalPatients = originalPatients
      state.excludedPatients = excludedPatients
    },
    updateCohort: (state: ExploredCohortState, action: PayloadAction<GroupMember[]>) => {
      return {
        ...state,
        cohort:
          Array.isArray(state.cohort) || !state.cohort
            ? state.cohort
            : {
                ...state.cohort,
                member: action.payload
              },
        importedPatients: [],
        includedPatients: [],
        excludedPatients: []
      }
    }
  },
  extraReducers: (builder) => {
    builder.addCase(login, () => defaultInitialState)
    builder.addCase(logout.fulfilled, () => defaultInitialState)
    builder.addCase(fetchExploredCohort.pending, (state) => ({ ...state, loading: true, rightToExplore: undefined }))
    builder.addCase(fetchExploredCohort.fulfilled, (state, { payload }) => ({
      ...state,
      ...payload,
      loading: false,
      rightToExplore: true
    }))
    builder.addCase(fetchExploredCohort.rejected, () => ({ ...defaultInitialState, rightToExplore: false }))
    builder.addCase(fetchExploredCohortInBackground.pending, (state) => ({
      ...state,
      loading: true,
      rightToExplore: undefined
    }))
    builder.addCase(fetchExploredCohortInBackground.fulfilled, (state, { payload }) => ({
      ...state,
      ...payload,
      loading: false,
      rightToExplore: true
    }))
    builder.addCase(fetchExploredCohortInBackground.rejected, () => ({ ...defaultInitialState, rightToExplore: false }))
    builder.addCase(favoriteExploredCohort.pending, (state) => ({ ...state }))
    builder.addCase(favoriteExploredCohort.fulfilled, (state, { payload }) => ({
      ...state,
      ...payload
    }))
    builder.addCase(favoriteExploredCohort.rejected, () => ({ ...defaultInitialState }))
  }
})

export default exploredCohortSlice.reducer
export { fetchExploredCohort, favoriteExploredCohort, fetchExploredCohortInBackground }
export const { addImportedPatients, excludePatients, removeImportedPatients, includePatients, removeExcludedPatients } =
  exploredCohortSlice.actions
