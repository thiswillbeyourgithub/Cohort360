import React from 'react'
import {
  CssBaseline,
  // Chip,
  Grid,
  Paper,
  // IconButton,
  TableCell,
  TableRow,
  TableHead,
  Table,
  TableBody,
  TableContainer,
  CircularProgress,
  Typography
} from '@material-ui/core'

// import CloseIcon from '@material-ui/icons/Close'
// import MoreHorizIcon from '@material-ui/icons/MoreHoriz'

import PieChart from './Charts/PieChart'
import BarChart from './Charts/BarChart'
import GroupedBarChart from './Charts/GroupedBarChart'
import DonutChart from './Charts/DonutChart'
import PyramidChart from './Charts/PyramidChart'

import useStyles from './styles'

import { getGenderRepartitionSimpleData } from 'utils/graphUtils'
import displayDigit from 'utils/displayDigit'

import { SimpleChartDataType, GenderRepartitionType, AgeRepartitionType, VisiteRepartitionType } from 'types'
// import { Skeleton } from '@material-ui/lab'

type RepartitionTableProps = {
  genderRepartitionMap?: GenderRepartitionType
  loading?: boolean
}

const RepartitionTable: React.FC<RepartitionTableProps> = ({ genderRepartitionMap, loading }) => {
  const classes = useStyles()
  let femaleAlive, maleAlive, femaleDeceased, maleDeceased
  if (loading) {
    return (
      <Paper className={classes.repartitionTable}>
        <Grid className={classes.progressContainer}>
          <CircularProgress />
        </Grid>
      </Paper>
    )
  }

  if (genderRepartitionMap) {
    const femaleValues = genderRepartitionMap.female
    const maleValues = genderRepartitionMap.male

    femaleAlive = femaleValues?.alive
    femaleDeceased = femaleValues?.deceased
    maleAlive = maleValues?.alive
    maleDeceased = maleValues?.deceased
  }

  return (
    <TableContainer id="repartition-table-card" component={Paper} className={classes.repartitionTable}>
      <Table aria-label="simple table">
        <TableHead>
          <TableRow className={classes.tableHead}>
            <TableCell variant="head" />
            <TableCell align="center" className={classes.tableHeadCell}>
              Vivant
            </TableCell>
            <TableCell align="center" className={classes.tableHeadCell}>
              Décédé
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell component="th" scope="row" className={classes.tableHeadCell}>
              Femmes
            </TableCell>
            <TableCell id="female-alive-cell" align="center">
              {displayDigit(femaleAlive ?? 0)}
            </TableCell>
            <TableCell id="female-deceased-cell" align="center">
              {displayDigit(femaleDeceased ?? 0)}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" scope="row" className={classes.tableHeadCell}>
              Hommes
            </TableCell>
            <TableCell id="male-alive-cell" align="center">
              {displayDigit(maleAlive ?? 0)}
            </TableCell>
            <TableCell id="male-deceased-cell" align="center">
              {displayDigit(maleDeceased ?? 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}

type PreviewProps = {
  total?: number
  loading?: boolean
  genderRepartitionMap?: GenderRepartitionType
  visitTypeRepartitionData?: SimpleChartDataType[]
  monthlyVisitData?: VisiteRepartitionType
  agePyramidData?: AgeRepartitionType
}
const Preview: React.FC<PreviewProps> = ({
  total,
  genderRepartitionMap,
  visitTypeRepartitionData,
  monthlyVisitData,
  agePyramidData,
  loading
}) => {
  const classes = useStyles()

  const { vitalStatusData, genderData } = getGenderRepartitionSimpleData(genderRepartitionMap)

  return (
    <Grid container direction="column" alignItems="center" className={classes.root}>
      <CssBaseline />
      <Grid container direction="column" xs={11} justify="space-between">
        {/* <Grid container item className={classes.header} justify="center">
          <Grid container item alignItems="center" md={11}>
            <Grid container item direction="column">
              <Typography variant="h2" color="primary">
                {loading ? <Skeleton width={200} height={40} /> : title}
              </Typography>
              {description && (
                <Typography variant="subtitle2">
                  {loading ? <Skeleton width={150} height={20} /> : description}
                </Typography>
              )}

              {group.perimeters && (
                <ul className={classes.perimetersChipsDiv}>
                  {loading ? (
                    <li>
                      <Skeleton width={100} />
                    </li>
                  ) : isExtended ? (
                    <>
                      {group.perimeters &&
                        group.perimeters.map((perimeter: any) => (
                          <li key={perimeter} className={classes.item}>
                            <Chip className={classes.perimetersChip} label={perimeter} />
                          </li>
                        ))}
                      <IconButton
                        size="small"
                        classes={{ label: classes.populationLabel }}
                        onClick={() => onExtend(false)}
                      >
                        <CloseIcon />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      {group.perimeters &&
                        group.perimeters.slice(0, 4).map((perimeter) => (
                          <li key={perimeter} className={classes.item}>
                            <Chip className={classes.perimetersChip} label={perimeter} />
                          </li>
                        ))}
                      {group.perimeters && group.perimeters.length > 4 && (
                        <IconButton
                          size="small"
                          classes={{ label: classes.populationLabel }}
                          onClick={() => onExtend(true)}
                        >
                          <MoreHorizIcon />
                        </IconButton>
                      )}
                    </>
                  )}
                </ul>
              )}
            </Grid>
          </Grid>
        </Grid> */}

        <Grid container item justify="space-between" alignItems="center">
          <Grid container item xs={12} sm={6} md={4} justify="center">
            <Paper id="patient-number-card" className={classes.nbPatientsOverlay}>
              <Grid container item className={classes.chartTitle}>
                <Typography id="patient-number-card-title" variant="h3" color="primary">
                  Nombre de patients
                </Typography>
              </Grid>

              {loading || !total ? (
                <Grid className={classes.progressContainer}>
                  <CircularProgress />
                </Grid>
              ) : (
                <Typography id="patient-number-card-value" variant="h4" className={classes.nbPatients}>
                  {displayDigit(total)} patients
                </Typography>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={8}>
            <RepartitionTable genderRepartitionMap={genderRepartitionMap} loading={loading} />
          </Grid>
        </Grid>

        <Grid container>
          <Grid container item xs={12} sm={6} lg={4} justify="center">
            <Paper id="vital-repartition-card" className={classes.chartOverlay}>
              <Grid container item className={classes.chartTitle}>
                <Typography id="vital-repartition-card-title" variant="h3" color="primary">
                  Répartition par statut vital
                </Typography>
              </Grid>

              {loading || !vitalStatusData ? (
                <Grid className={classes.progressContainer}>
                  <CircularProgress />
                </Grid>
              ) : (
                <PieChart data={vitalStatusData ?? []} />
              )}
            </Paper>
          </Grid>

          <Grid container item xs={12} sm={6} lg={4} justify="center">
            <Paper id="visit-type-repartition-card" className={classes.chartOverlay}>
              <Grid container item className={classes.chartTitle}>
                <Typography id="visit-type-repartition-card-title" variant="h3" color="primary">
                  Répartition par type de visite
                </Typography>
              </Grid>

              {loading ? (
                <Grid className={classes.progressContainer}>
                  <CircularProgress />
                </Grid>
              ) : (
                <DonutChart data={visitTypeRepartitionData} />
              )}
            </Paper>
          </Grid>

          <Grid container item xs={12} sm={12} lg={4} justify="center">
            <Paper id="gender-repartition-card" className={classes.chartOverlay}>
              <Grid container item className={classes.chartTitle}>
                <Typography id="gender-repartition-card-title" variant="h3" color="primary">
                  Répartition par genre
                </Typography>
              </Grid>

              {loading ? (
                <Grid className={classes.progressContainer}>
                  <CircularProgress />
                </Grid>
              ) : (
                <BarChart data={genderData} />
              )}
            </Paper>
          </Grid>

          <Grid container item md={12} lg={6} justify="center">
            <Grid container item justify="center">
              <Paper id="age-structure-card" className={classes.chartOverlay}>
                <Grid container item className={classes.chartTitle}>
                  <Typography id="age-structure-card-title" variant="h3" color="primary">
                    Pyramide des âges
                  </Typography>
                </Grid>

                {loading ? (
                  <Grid className={classes.progressContainer}>
                    <CircularProgress />
                  </Grid>
                ) : (
                  <PyramidChart data={agePyramidData} />
                )}
              </Paper>
            </Grid>
          </Grid>

          <Grid container item md={12} lg={6} justify="center">
            <Grid container item justify="center">
              <Paper id="month-repartition-visit-card" className={classes.chartOverlay}>
                <Grid container item className={classes.chartTitle}>
                  <Typography id="month-repartition-visit-card-title" variant="h3" color="primary">
                    Répartition des visites par mois
                  </Typography>
                </Grid>

                {loading ? (
                  <Grid className={classes.progressContainer}>
                    <CircularProgress />
                  </Grid>
                ) : (
                  <GroupedBarChart data={monthlyVisitData} />
                )}
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  )
}

export default Preview
