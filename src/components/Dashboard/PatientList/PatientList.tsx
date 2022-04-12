import React, { useState, useEffect } from 'react'
import moment from 'moment'

import {
  Button,
  CircularProgress,
  CssBaseline,
  Grid,
  IconButton,
  InputAdornment,
  InputBase,
  MenuItem,
  Paper,
  Select,
  Typography
} from '@material-ui/core'

import PatientFilters from 'components/Filters/PatientFilters/PatientFilters'
import DataTablePatient from 'components/DataTable/DataTablePatient'

import PieChart from '../Preview/Charts/PieChart'
import BarChart from '../Preview/Charts/BarChart'
import PyramidChart from '../Preview/Charts/PyramidChart'

import { ReactComponent as SearchIcon } from 'assets/icones/search.svg'
import { ReactComponent as FilterList } from 'assets/icones/filter.svg'
import LockIcon from '@material-ui/icons/Lock'
import ClearIcon from '@material-ui/icons/Clear'

import MasterChips from 'components/MasterChips/MasterChips'

import services from 'services'
import { PatientGenderKind } from '@ahryman40k/ts-fhir-types/lib/R4'
import {
  AgeRepartitionType,
  CohortPatient,
  GenderRepartitionType,
  Order,
  PatientFilters as PatientFiltersType,
  SearchByTypes,
  SimpleChartDataType,
  VitalStatus
} from 'types'

import { getGenderRepartitionSimpleData } from 'utils/graphUtils'
import displayDigit from 'utils/displayDigit'
import { buildPatientFiltersChips } from 'utils/chips'

import useStyles from './styles'

type PatientListProps = {
  total: number
  groupId?: string
  deidentified?: boolean | null
  patients?: CohortPatient[]
  loading?: boolean
  agePyramidData?: AgeRepartitionType
  genderRepartitionMap?: GenderRepartitionType
}

const PatientList: React.FC<PatientListProps> = ({
  groupId,
  total,
  deidentified,
  patients,
  agePyramidData,
  genderRepartitionMap
}) => {
  const classes = useStyles()
  const [page, setPage] = useState(1)
  const [totalPatients, setTotalPatients] = useState(total)
  const [patientsList, setPatientsList] = useState(patients)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchBy, setSearchBy] = useState<SearchByTypes>(SearchByTypes.text)
  const [agePyramid, setAgePyramid] = useState<AgeRepartitionType | undefined>(undefined)

  const [patientData, setPatientData] = useState<
    { vitalStatusData?: SimpleChartDataType[]; genderData?: SimpleChartDataType[] } | undefined
  >(undefined)
  const [open, setOpen] = useState(false)

  const [filters, setFilters] = useState<PatientFiltersType>({
    gender: PatientGenderKind._unknown,
    birthdates: [moment().subtract(130, 'years').format('YYYY-MM-DD'), moment().format('YYYY-MM-DD')],
    vitalStatus: VitalStatus.all
  })

  const [order, setOrder] = useState<Order>({
    orderBy: 'given',
    orderDirection: 'asc'
  })

  useEffect(() => {
    setAgePyramid(agePyramidData)
  }, [agePyramidData])

  useEffect(() => {
    setPatientData(getGenderRepartitionSimpleData(genderRepartitionMap))
  }, [genderRepartitionMap])

  useEffect(() => {
    setPatientsList(patients)
  }, [patients])

  const fetchPatients = async (pageValue = 1, includeFacets: boolean, inputSearch = searchInput) => {
    setLoadingStatus(true)
    // Set loader on chart
    if (includeFacets) {
      setPatientData(undefined)
      setAgePyramid(undefined)
    }
    const result = await services.cohorts.fetchPatientList(
      pageValue,
      searchBy,
      inputSearch,
      filters.gender,
      filters.birthdates,
      filters.vitalStatus,
      order.orderBy,
      order.orderDirection,
      groupId,
      includeFacets
    )
    if (result) {
      const { totalPatients, originalPatients, genderRepartitionMap, agePyramidData } = result
      setPatientsList(originalPatients)
      if (includeFacets) {
        setPatientData(getGenderRepartitionSimpleData(genderRepartitionMap))
        setAgePyramid(agePyramidData)
      }
      setTotalPatients(totalPatients)
    }
    setLoadingStatus(false)
  }

  const onSearchPatient = (inputSearch?: string) => {
    setPage(1)
    fetchPatients(1, true, inputSearch)
  }

  useEffect(() => {
    onSearchPatient()
  }, [filters, order, searchBy]) // eslint-disable-line

  const handleChangeSelect = (
    event: React.ChangeEvent<{
      name?: string | undefined
      value: unknown
    }>
  ) => {
    setSearchBy(event.target.value as SearchByTypes)
  }

  const handleChangeInput = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setSearchInput(event.target.value)
  }

  const handleChangePage = (value?: number) => {
    setPage(value ?? 1)
    //We only fetch patients if we don't already have them
    if (patients && patients.length < totalPatients) {
      fetchPatients(value ?? 1, false)
    }
  }

  const handleClearInput = async () => {
    setSearchInput('')
    onSearchPatient('')
  }

  const handleDeleteChip = (filterName: string) => {
    switch (filterName) {
      case 'gender':
        setFilters((prevFilters) => ({
          ...prevFilters,
          gender: PatientGenderKind._unknown
        }))
        break
      case 'birthdates':
        setFilters((prevFilters) => ({
          ...prevFilters,
          birthdates: [moment().subtract(130, 'years').format('YYYY-MM-DD'), moment().format('YYYY-MM-DD')]
        }))
        break
      case 'vitalStatus':
        setFilters((prevFilters) => ({
          ...prevFilters,
          vitalStatus: VitalStatus.all
        }))
        break
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.keyCode === 13) {
      e.preventDefault()
      onSearchPatient()
    }
  }

  return (
    <Grid container direction="column" alignItems="center">
      <CssBaseline />
      <Grid container item xs={11} justifyContent="space-between">
        <Grid container>
          <Grid container item xs={12} md={6} lg={4} justifyContent="center">
            <Paper className={classes.chartOverlay}>
              <Grid container item className={classes.chartTitle}>
                <Typography variant="h3" color="primary">
                  Répartition par genre
                </Typography>
              </Grid>
              {patientData === undefined || (patientData && patientData.genderData === undefined) ? (
                <Grid container justifyContent="center" alignItems="center">
                  <CircularProgress />
                </Grid>
              ) : patientData.genderData && patientData.genderData.length > 0 ? (
                <BarChart data={patientData.genderData ?? []} />
              ) : (
                <Typography>Aucun patient</Typography>
              )}
            </Paper>
          </Grid>

          <Grid container item xs={12} md={6} lg={4} justifyContent="center">
            <Paper className={classes.chartOverlay}>
              <Grid container item className={classes.chartTitle}>
                <Typography variant="h3" color="primary">
                  Répartition par statut vital
                </Typography>
              </Grid>
              {patientData === undefined || (patientData && patientData.vitalStatusData === undefined) ? (
                <Grid container justifyContent="center" alignItems="center">
                  <CircularProgress />
                </Grid>
              ) : patientData.vitalStatusData &&
                patientData.vitalStatusData.find(({ value }) => value !== 0) !== undefined ? (
                <PieChart data={patientData.vitalStatusData ?? []} />
              ) : (
                <Typography>Aucun patient</Typography>
              )}
            </Paper>
          </Grid>

          <Grid container item md={12} lg={4} justifyContent="center">
            <Paper className={classes.chartOverlay}>
              <Grid container item className={classes.chartTitle}>
                <Typography variant="h3" color="primary">
                  Pyramide des âges
                </Typography>
              </Grid>
              {agePyramid === undefined ? (
                <Grid container justifyContent="center" alignItems="center">
                  <CircularProgress />
                </Grid>
              ) : agePyramid && agePyramid.length > 0 ? (
                <PyramidChart data={agePyramid} width={250} />
              ) : (
                <Typography>Aucun patient</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Grid id="patient-data-grid" container item justifyContent="flex-end" className={classes.tableGrid}>
          <Grid container justifyContent="space-between" alignItems="center">
            <Typography variant="button">
              {displayDigit(totalPatients)} / {displayDigit(total)} patient(s)
            </Typography>
            <div className={classes.tableButtons}>
              {deidentified ? (
                <Grid container alignItems="center">
                  <LockIcon />
                  <Typography variant="h6">Recherche désactivée car patients dé-identifiés.</Typography>
                </Grid>
              ) : (
                <>
                  <Select value={searchBy} onChange={handleChangeSelect} className={classes.select}>
                    <MenuItem value={SearchByTypes.text}>Tous les champs</MenuItem>
                    <MenuItem value={SearchByTypes.family}>Nom</MenuItem>
                    <MenuItem value={SearchByTypes.given}>Prénom</MenuItem>
                    <MenuItem value={SearchByTypes.identifier}>IPP</MenuItem>
                  </Select>
                  <Grid item container xs={10} alignItems="center" className={classes.searchBar}>
                    <InputBase
                      placeholder="Rechercher"
                      className={classes.input}
                      value={searchInput}
                      onChange={handleChangeInput}
                      onKeyDown={onKeyDown}
                      endAdornment={
                        <InputAdornment position="end">
                          {searchInput && (
                            <IconButton onClick={handleClearInput}>
                              <ClearIcon />
                            </IconButton>
                          )}
                        </InputAdornment>
                      }
                    />
                    <IconButton type="submit" aria-label="search" onClick={() => onSearchPatient()}>
                      <SearchIcon fill="#ED6D91" height="15px" />
                    </IconButton>
                  </Grid>
                </>
              )}
              <Button
                variant="contained"
                disableElevation
                startIcon={<FilterList height="15px" fill="#FFF" />}
                className={classes.searchButton}
                onClick={() => setOpen(true)}
              >
                Filtrer
              </Button>
              <PatientFilters
                open={open}
                onClose={() => setOpen(false)}
                onSubmit={() => setOpen(false)}
                filters={filters}
                onChangeFilters={setFilters}
              />
            </div>
          </Grid>

          <MasterChips chips={buildPatientFiltersChips(filters, handleDeleteChip)} />

          <DataTablePatient
            loading={loadingStatus}
            groupId={groupId}
            deidentified={deidentified ?? false}
            patientsList={patientsList ?? []}
            order={order}
            setOrder={setOrder}
            page={page}
            setPage={(newPage) => handleChangePage(newPage)}
            total={totalPatients}
          />
        </Grid>
      </Grid>
    </Grid>
  )
}

export default PatientList
