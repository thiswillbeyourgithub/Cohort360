import React, { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useAppSelector } from 'state'

import Drawer from '@material-ui/core/Drawer'
import {
  Button,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Typography,
  Switch
} from '@material-ui/core'

import DeleteIcon from '@material-ui/icons/Delete'
import EditIcon from '@material-ui/icons/Edit'

import CriteriaRightPanel from '../CriteriaRightPanel/CriteriaRightPanel'
import CriteriaCardContent from '../CriteriaCardContent/CriteriaCardContent'

import { CriteriaItemType, SelectedCriteriaType, CriteriaGroupType } from 'types'

import {
  CohortCreationState,
  addNewSelectedCriteria,
  addNewCriteriaGroup,
  editCriteriaGroup,
  editSelectedCriteria,
  deleteSelectedCriteria,
  deleteCriteriaGroup
} from 'state/cohortCreation'

import useStyles from './styles'

type GroupListItemProps = {
  itemId: number
  editItem: (itemId: number) => void
  deleteItem: (itemId: number) => void
}

const GroupListItem: React.FC<GroupListItemProps> = ({ itemId, editItem, deleteItem }) => {
  const classes = useStyles()

  const { selectedCriteria = [], criteriaGroup = [] } = useAppSelector<{
    selectedCriteria: SelectedCriteriaType[]
    criteriaGroup: CriteriaGroupType[]
  }>((state) => state.cohortCreation.request || {})

  const isGroupObject = itemId < 0
  if (!isGroupObject) {
    const currentItem: any = selectedCriteria.find((criteria) => criteria.id === itemId)
    if (!currentItem) {
      // Bug, not possible ... The current item is not a criteria and is not a group ...
      return <></>
    }
    return (
      <ListItem classes={{ root: classes.listItem }} alignItems="flex-start">
        <ListItemText
          classes={{ primary: classes.listTitle, secondary: classes.listDesc }}
          primary={currentItem.title}
          secondaryTypographyProps={{ component: 'span' }}
          secondary={<CriteriaCardContent currentCriteria={currentItem} />}
        />
        <ListItemSecondaryAction>
          <Switch edge="end" />
          <IconButton onClick={() => editItem(itemId)} color="primary" edge="end" aria-label="edit">
            <EditIcon />
          </IconButton>
          <IconButton onClick={() => deleteItem(itemId)} color="primary" edge="end" aria-label="delete">
            <DeleteIcon />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    )
  } else {
    const currentItem: any = criteriaGroup.find((criteria) => criteria.id === itemId)
    if (!currentItem) {
      // Bug, not possible ... The current item is not a criteria and is not a group ...
      return <></>
    }
    return (
      <ListItem classes={{ root: classes.groupListItem }} alignItems="flex-start">
        <ListItemText classes={{ primary: classes.listTitle }} primary={currentItem.title} />

        <List style={{ width: '90%', alignSelf: 'center' }}>
          {currentItem &&
            currentItem.criteriaIds &&
            currentItem.criteriaIds.length > 0 &&
            currentItem.criteriaIds.map((criteriaId: number) => (
              <GroupListItem key={criteriaId} editItem={editItem} deleteItem={deleteItem} itemId={criteriaId} />
            ))}
        </List>

        <ListItemSecondaryAction style={{ top: 26 }}>
          <Switch edge="end" />
          <IconButton onClick={() => editItem(itemId)} color="primary" edge="end" aria-label="edit">
            <EditIcon />
          </IconButton>
          <IconButton onClick={() => deleteItem(itemId)} color="primary" edge="end" aria-label="delete">
            <DeleteIcon />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    )
  }
}

const initialState: CriteriaGroupType = {
  id: 0,
  title: 'Groupe de critère',
  type: 'andGroup',
  criteriaIds: [],
  isSubGroup: false,
  isInclusive: true,
  options: {
    operator: '='
  }
}

type GroupRightPanelProps = {
  open: boolean
  currentCriteriaGroup: CriteriaGroupType | null
  isSubGroup?: boolean
  onClose: (newSubGroupId?: number) => void
}

const GroupRightPanel: React.FC<GroupRightPanelProps> = (props) => {
  const { open, currentCriteriaGroup, isSubGroup, onClose } = props

  const isEditing = currentCriteriaGroup !== null

  const classes = useStyles()
  const dispatch = useDispatch()

  const { criteria = [], request } = useAppSelector<{
    criteria: CriteriaItemType[]
    request: CohortCreationState
  }>((state) => state.cohortCreation)

  const [openDrawer, setOpenDrawer] = useState<'criteria' | 'group' | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<number>(0)
  const [currentGroup, editCurrentGroup] = useState<CriteriaGroupType>(
    currentCriteriaGroup ?? { ...initialState, isSubGroup }
  )

  useEffect(() => {
    editCurrentGroup(currentCriteriaGroup ?? { ...initialState, isSubGroup })
  }, [open]) // eslint-disable-line

  const _addNewItem = (type: 'criteria' | 'group') => {
    setSelectedItemId(0)
    setOpenDrawer(type)
  }

  const _addCriteria = (newCriteria: SelectedCriteriaType) => {
    const isEdition = request?.selectedCriteria?.find(({ id }) => id === selectedItemId) !== undefined
    if (isEdition) {
      newCriteria.id = selectedItemId
      dispatch(editSelectedCriteria(newCriteria))
      setOpenDrawer(null)
    } else {
      newCriteria.id = request.nextCriteriaId
      dispatch(addNewSelectedCriteria(newCriteria))
      editCurrentGroup({
        ...currentGroup,
        criteriaIds: [...currentGroup.criteriaIds, newCriteria.id]
      })
    }
  }

  const _addSubGroup = (newSubGroupId?: number) => {
    if (newSubGroupId === undefined) return
    editCurrentGroup({
      ...currentGroup,
      criteriaIds: [...currentGroup.criteriaIds, newSubGroupId]
    })
    setOpenDrawer(null)
  }

  const _addGroup = () => {
    const isEdition = !!currentCriteriaGroup
    if (isEdition) {
      dispatch(editCriteriaGroup(currentGroup))
      onClose()
    } else {
      currentGroup.id = request.nextGroupId
      dispatch(addNewCriteriaGroup(currentGroup))
      editCurrentGroup({
        ...currentGroup,
        criteriaIds: [...currentGroup.criteriaIds, currentGroup.id]
      })
      onClose(currentGroup.id)
    }
  }

  const _editItem = (itemId: number) => {
    if (itemId < 0) {
      const _selectedGroup = request?.criteriaGroup?.find(({ id }) => id === itemId) ?? null
      if (_selectedGroup) {
        setSelectedItemId(itemId)
        setOpenDrawer('group')
      }
    } else {
      const _selectedCriteria = request?.selectedCriteria?.find(({ id }) => id === itemId) ?? null
      if (_selectedCriteria) {
        setSelectedItemId(itemId)
        setOpenDrawer('criteria')
      }
    }
  }

  const _deleteItem = (itemId: number) => {
    if (itemId < 0) {
      const deletedCriteriaGroup = request?.criteriaGroup
        ? request?.criteriaGroup.find(({ id }) => id === itemId)
        : null
      const children = deletedCriteriaGroup?.criteriaIds ?? []
      for (const childItemId of children) {
        if (childItemId > 0) {
          dispatch(deleteSelectedCriteria(childItemId))
        } else {
          _deleteItem(childItemId)
        }
      }
      dispatch(deleteCriteriaGroup(itemId))
    } else {
      dispatch(deleteSelectedCriteria(itemId))
    }
    const criteriaIds = currentGroup.criteriaIds ? [...currentGroup.criteriaIds] : []
    const index = criteriaIds.indexOf(itemId) ?? -1
    if (index !== -1) {
      criteriaIds.splice(index, 1)
      editCurrentGroup({
        ...currentGroup,
        criteriaIds
      })
    }
  }

  return (
    <>
      <Drawer anchor="right" open={open} onClose={() => onClose()}>
        <div className={classes.root}>
          <Grid className={classes.drawerTitleContainer}>
            {isSubGroup ? (
              <Typography className={classes.title}>
                {!isEditing ? 'Ajouter' : 'Modifier'} un sous-groupe de critère
              </Typography>
            ) : (
              <Typography className={classes.title}>
                {!isEditing ? 'Ajouter' : 'Modifier'} un groupe de critère
              </Typography>
            )}
          </Grid>

          <Grid className={classes.drawerContentContainer}>
            <Typography variant="subtitle2">Groupe de critère</Typography>

            <TextField
              variant="outlined"
              margin="normal"
              fullWidth
              placeholder="Nom du groupe"
              value={currentGroup.title}
              onChange={(e) => editCurrentGroup({ ...currentGroup, title: e.target.value })}
            />

            <List>
              {currentGroup &&
                currentGroup.criteriaIds &&
                currentGroup.criteriaIds.length > 0 &&
                currentGroup.criteriaIds.map((criteriaId: number) => (
                  <GroupListItem key={criteriaId} itemId={criteriaId} editItem={_editItem} deleteItem={_deleteItem} />
                ))}
            </List>

            <Button
              style={{ borderRadius: 38 }}
              color="primary"
              variant="contained"
              onClick={() => _addNewItem('criteria')}
            >
              Ajouter un critère
            </Button>

            <Button
              disabled={isSubGroup}
              style={{ borderRadius: 38, marginLeft: 8 }}
              color="primary"
              variant="contained"
              onClick={() => _addNewItem('group')}
            >
              Ajouter un sous groupe de critère
            </Button>
          </Grid>

          <>{/* ICI OPTIONS DE GROUPE */}</>
        </div>

        <Grid className={classes.groupActionContainer}>
          {!currentCriteriaGroup && (
            <Button onClick={() => onClose()} color="primary" variant="outlined">
              Annuler
            </Button>
          )}
          <Button onClick={_addGroup} type="submit" color="primary" variant="contained">
            Confirmer
          </Button>
        </Grid>
      </Drawer>

      {!isSubGroup && (
        <GroupRightPanel
          isSubGroup
          currentCriteriaGroup={request?.criteriaGroup?.find(({ id }) => id === selectedItemId) ?? null}
          open={openDrawer === 'group'}
          onClose={(newSubGroupId?: number) => (newSubGroupId ? _addSubGroup(newSubGroupId) : setOpenDrawer(null))}
        />
      )}

      <CriteriaRightPanel
        criteria={criteria}
        selectedCriteria={request?.selectedCriteria?.find(({ id }) => id === selectedItemId) ?? null}
        onChangeSelectedCriteria={_addCriteria}
        open={openDrawer === 'criteria'}
        onClose={() => setOpenDrawer(null)}
        goBack={() => setOpenDrawer(null)}
      />
    </>
  )
}

export default GroupRightPanel
