import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

import { RootState } from 'state'
import { login, logout } from 'state/me'

import services from 'services/aphp'
import { AbstractTree } from 'types'

export type MedicationListType = AbstractTree<{ label: string }>

export type MedicationState = {
  syncLoading?: number
  loading: boolean
  list: MedicationListType[]
  openedElement: string[]
}

const defaultInitialState: MedicationState = {
  loading: false,
  list: [],
  openedElement: []
}

const initMedicationHierarchy = createAsyncThunk<MedicationState, void, { state: RootState }>(
  'medication/fetchElements',
  async (DO_NOT_USE, { getState }) => {
    try {
      const state = getState().medication
      const { list } = state

      const medicationList: MedicationListType[] =
        list.length === 0 ? await services.cohortCreation.fetchAtcHierarchy('') : list

      return {
        ...state,
        loading: false,
        list: medicationList
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }
)

const fetchMedication = createAsyncThunk<MedicationState, void, { state: RootState }>(
  'medication/fetchMedication',
  async (DO_NOT_USE, { getState }) => {
    const state = getState().medication
    const medicationList: MedicationListType[] = await services.cohortCreation.fetchAtcHierarchy('')

    return {
      ...state,
      list: medicationList,
      openedElement: [],
      loading: false
    }
  }
)

type ExpandMedicationElementParams = {
  rowId: string
  selectedItems?: MedicationListType[]
}

const expandMedicationElement = createAsyncThunk<MedicationState, ExpandMedicationElementParams, { state: RootState }>(
  'scope/expandMedicationElement',
  async ({ rowId, selectedItems }, { getState }) => {
    const state = getState().medication
    const listElement = state.list
    const openedElement = state.openedElement

    let _rootRows = listElement ? [...listElement] : []
    let _openedElement = openedElement ? [...openedElement] : []
    let savedSelectedItems = selectedItems ? [...selectedItems] : []

    const index = _openedElement.indexOf(rowId)
    if (index !== -1) {
      _openedElement = _openedElement.filter((id) => id !== rowId)
    } else {
      _openedElement = [..._openedElement, rowId]

      const replaceSubItems = async (items: MedicationListType[]) => {
        let _items: MedicationListType[] = []
        for (let item of items) {
          // Replace sub items element by response of back-end
          if (item.id === rowId) {
            const foundItem = item.subItems ? item.subItems.find((i) => i.id === 'loading') : true
            if (foundItem) {
              let subItems: MedicationListType[] = []
              subItems = await services.cohortCreation.fetchAtcHierarchy(item.id)

              item = { ...item, subItems: subItems }
            }
          } else if (item.subItems && item.subItems.length !== 0) {
            item = { ...item, subItems: await replaceSubItems(item.subItems) }
          }
          _items = [..._items, item]

          // Check if element is selected, if true => add sub items to savedSelectedItems
          const isSelected = savedSelectedItems.find(
            (savedSelectedItem: MedicationListType) => savedSelectedItem.id === item.id
          )
          if (isSelected !== undefined && item.subItems && item.subItems.length > 0) {
            savedSelectedItems = [...savedSelectedItems, ...item.subItems]
          }
        }
        return _items
      }

      _rootRows = await replaceSubItems(listElement)
    }

    return {
      ...state,
      loading: false,
      list: _rootRows,
      openedElement: _openedElement,
      savedSelectedItems: savedSelectedItems.filter((savedSelectedItem) => savedSelectedItem.id !== 'loading')
    }
  }
)

const medicationSlice = createSlice({
  name: 'medication',
  initialState: defaultInitialState as MedicationState,
  reducers: {
    clearMedicationHierarchy: () => {
      return {
        loading: false,
        list: [],
        openedElement: []
      }
    }
  },
  extraReducers: (builder) => {
    builder.addCase(login, () => defaultInitialState)
    builder.addCase(logout.fulfilled, () => defaultInitialState)
    // initMedicationHierarchy
    builder.addCase(initMedicationHierarchy.pending, (state) => ({ ...state, loading: true }))
    builder.addCase(initMedicationHierarchy.fulfilled, (state, action) => ({ ...state, ...action.payload }))
    builder.addCase(initMedicationHierarchy.rejected, (state) => ({ ...state }))
    // fetchMedication
    builder.addCase(fetchMedication.pending, (state) => ({ ...state, loading: true }))
    builder.addCase(fetchMedication.fulfilled, (state, action) => ({ ...state, ...action.payload }))
    builder.addCase(fetchMedication.rejected, (state) => ({ ...state }))
    // expandMedicationElement
    builder.addCase(expandMedicationElement.pending, (state) => ({
      ...state,
      loading: true,
      syncLoading: (state.syncLoading ?? 0) + 1
    }))
    builder.addCase(expandMedicationElement.fulfilled, (state, action) => ({
      ...state,
      ...action.payload,
      syncLoading: (state.syncLoading ?? 0) - 1
    }))
    builder.addCase(expandMedicationElement.rejected, (state) => ({ ...state }))
  }
})

export default medicationSlice.reducer
export { initMedicationHierarchy, fetchMedication, expandMedicationElement }
export const { clearMedicationHierarchy } = medicationSlice.actions
