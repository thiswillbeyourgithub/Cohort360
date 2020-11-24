import React from 'react'

import { Button, Divider, Grid, IconButton, Typography } from '@material-ui/core'
import KeyboardBackspaceIcon from '@material-ui/icons/KeyboardBackspace'

import { FormBuilder } from '@arkhn/ui'

import useStyles from './styles'

import { DocumentDataType } from 'types'

type TestGeneratedFormProps = {
  criteria: any
  selectedCriteria: any
  goBack: (data: any) => void
  onChangeSelectedCriteria: (data: any) => void
}

const defaultDemographic = {
  title: 'Critère de document',
  search: '',
  docType: { id: '55188-7', label: 'Tout type de documents' }
}

const TestGeneratedForm: React.FC<TestGeneratedFormProps> = (props) => {
  const { selectedCriteria, onChangeSelectedCriteria, goBack } = props
  const defaultValues = selectedCriteria || defaultDemographic

  const classes = useStyles()

  const isEdition = selectedCriteria !== null ? true : false

  const _onSubmit = (data: any) => {
    onChangeSelectedCriteria({
      title: data.title,
      search: data.search,
      docType: data.docType,
      type: 'documents_cliniques'
    })
  }

  return (
    <Grid className={classes.root}>
      <Grid className={classes.actionContainer}>
        {!isEdition ? (
          <>
            <IconButton className={classes.backButton} onClick={goBack}>
              <KeyboardBackspaceIcon />
            </IconButton>
            <Divider className={classes.divider} orientation="vertical" flexItem />
            <Typography className={classes.titleLabel}>Ajouter un critère de documents médicaux</Typography>
          </>
        ) : (
          <Typography className={classes.titleLabel}>Modifier un critère de documents médicaux</Typography>
        )}
      </Grid>

      <FormBuilder<DocumentDataType>
        defaultValues={defaultValues}
        title={'Documents médicaux'}
        properties={[
          {
            name: 'title',
            placeholder: 'Nom du critère',
            type: 'text',
            variant: 'outlined',
            validationRules: {
              required: 'Merci de renseigné un titre'
            }
          },
          {
            name: 'search',
            placeholder: 'Recherche',
            type: 'text',
            variant: 'outlined'
          },
          {
            label: 'Rechercher dans :',
            name: 'docType',
            type: 'select',
            selectOptions: [
              { id: '55188-7', label: 'Tout type de documents' },
              { id: '11336-5', label: "Comptes rendus d'hospitalisation" },
              { id: '57833-6', label: 'Ordonnances' }
            ]
          }
        ]}
        submit={_onSubmit}
        formId="documents-form"
        formFooter={
          <Grid className={classes.criteriaActionContainer}>
            {!isEdition && (
              <Button onClick={goBack} color="primary" variant="outlined">
                Annuler
              </Button>
            )}
            <Button type="submit" form="document-form" color="primary" variant="contained">
              Confirmer
            </Button>
          </Grid>
        }
      />
    </Grid>
  )
}

export default TestGeneratedForm
