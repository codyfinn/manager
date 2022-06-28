import { Disk, getLinodeDisks, Linode } from '@linode/api-v4/lib/linodes';
import { APIError } from '@linode/api-v4/lib/types';
import { makeStyles } from '@material-ui/styles';
import { useSnackbar } from 'notistack';
import { equals } from 'ramda';
import * as React from 'react';
import { useHistory } from 'react-router-dom';
import { compose } from 'recompose';
import Button from 'src/components/Button';
import Box from 'src/components/core/Box';
import Paper from 'src/components/core/Paper';
import { Theme } from 'src/components/core/styles';
import Notice from 'src/components/Notice';
import TextField from 'src/components/TextField';
import withImages, {
  ImagesDispatch,
} from 'src/containers/withImages.container';
import { resetEventsPolling } from 'src/eventsPolling';
import DiskSelect from 'src/features/linodes/DiskSelect';
import LinodeSelect from 'src/features/linodes/LinodeSelect';
import { useGrants, useProfile } from 'src/queries/profile';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import getAPIErrorFor from 'src/utilities/getAPIErrorFor';

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    padding: theme.spacing(3),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(),
    '& .MuiFormHelperText-root': {
      marginBottom: theme.spacing(2),
    },
  },
  buttonGroup: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('xs')]: {
      justifyContent: 'flex-end',
    },
  },
  rawDiskWarning: {
    maxWidth: 600,
    width: '100%',
  },
  diskAndPrice: {
    '& > div': {
      width: 415,
    },
  },
  helperText: {
    marginBottom: theme.spacing(),
    marginLeft: theme.spacing(1.5),
    whiteSpace: 'nowrap',
  },
}));

export interface Props {
  label?: string;
  description?: string;
  changeLabel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  changeDescription: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CreateImageTab: React.FC<Props & ImagesDispatch> = (props) => {
  const {
    label,
    description,
    changeLabel,
    changeDescription,
    createImage,
  } = props;

  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();
  const { push } = useHistory();

  const { data: profile } = useProfile();
  const { data: grants } = useGrants();

  const [selectedLinode, setSelectedLinode] = React.useState<Linode>();
  const [selectedDisk, setSelectedDisk] = React.useState<string | null>('');
  const [disks, setDisks] = React.useState<Disk[]>([]);
  const [notice, setNotice] = React.useState<string | undefined>();
  const [errors, setErrors] = React.useState<APIError[] | undefined>();
  const [submitting, setSubmitting] = React.useState<boolean>(false);

  const canCreateImage =
    Boolean(!profile?.restricted) || Boolean(grants?.global?.add_images);

  const availableLinodesToImagize = profile?.restricted
    ? grants?.linode
        .filter((thisGrant) => thisGrant.permissions === 'read_write')
        .map((thisGrant) => thisGrant.id) ?? []
    : null;

  const fetchLinodeDisksOnLinodeChange = (selectedLinode: number) => {
    setSelectedDisk('');

    getLinodeDisks(selectedLinode)
      .then((response) => {
        const filteredDisks = response.data.filter(
          (disk) => disk.filesystem !== 'swap'
        );

        if (!equals(disks, filteredDisks)) {
          setDisks(filteredDisks);
        }
      })
      .catch((_) => {
        setErrors([
          {
            field: 'disk_id',
            reason: 'Could not retrieve disks for this Linode.',
          },
        ]);
      });
  };

  const changeSelectedLinode = (linode: Linode) => {
    fetchLinodeDisksOnLinodeChange(linode.id);
    setSelectedLinode(linode);
  };

  const handleLinodeChange = (linode: Linode | null) => {
    if (linode !== null) {
      // Clear any errors
      setErrors(undefined);
      changeSelectedLinode(linode);
    }
  };

  const handleDiskChange = (diskID: string | null) => {
    // Clear any errors
    setErrors(undefined);
    setSelectedDisk(diskID);
  };

  const onSubmit = () => {
    setErrors(undefined);
    setNotice(undefined);
    setSubmitting(true);

    const safeDescription = description ?? '';
    createImage({
      diskID: Number(selectedDisk),
      label,
      description: safeDescription,
    })
      .then((_) => {
        resetEventsPolling();

        setSubmitting(false);

        enqueueSnackbar('Image scheduled for creation.', {
          variant: 'info',
        });

        push('/images');
      })
      .catch((errorResponse) => {
        setSubmitting(false);
        setErrors(
          getAPIErrorOrDefault(
            errorResponse,
            'There was an error creating the image.'
          )
        );
      });
  };

  const checkRequirements = () => {
    // When creating an image, disable the submit button until a Linode and
    // disk are selected.
    const isDiskSelected = Boolean(selectedDisk);

    return !(isDiskSelected && selectedLinode);
  };

  const requirementsMet = checkRequirements();

  const selectedDiskData: Disk | undefined = disks.find(
    (d) => `${d.id}` === selectedDisk
  );

  const isRawDisk = selectedDiskData?.filesystem === 'raw';
  const rawDiskWarning = (
    <Notice
      className={classes.rawDiskWarning}
      spacingTop={16}
      spacingBottom={32}
      warning
      text={rawDiskWarningText}
    />
  );

  const hasErrorFor = getAPIErrorFor(
    {
      linode_id: 'Linode',
      disk_id: 'Disk',
      region: 'Region',
      size: 'Size',
      label: 'Label',
    },
    errors
  );

  const labelError = hasErrorFor('label');
  const descriptionError = hasErrorFor('description');
  const generalError = hasErrorFor('none');
  const linodeError = hasErrorFor('linode_id');
  const diskError = hasErrorFor('disk_id');

  return (
    <Paper className={classes.container}>
      {!canCreateImage ? (
        <Notice
          error
          text="You don't have permissions to create a new Image. Please contact an account administrator for details."
        />
      ) : null}
      {generalError ? (
        <Notice error text={generalError} data-qa-notice />
      ) : null}
      {notice ? <Notice success text={notice} data-qa-notice /> : null}
      <LinodeSelect
        selectedLinode={selectedLinode?.id || null}
        linodeError={linodeError}
        disabled={!canCreateImage}
        handleChange={(linode) => handleLinodeChange(linode)}
        filterCondition={(linode) =>
          availableLinodesToImagize
            ? availableLinodesToImagize.includes(linode.id)
            : true
        }
        updateFor={[
          selectedLinode,
          linodeError,
          classes,
          canCreateImage,
          availableLinodesToImagize,
        ]}
        isClearable={false}
        required
      />

      <Box
        display="flex"
        alignItems="flex-end"
        className={classes.diskAndPrice}
      >
        <DiskSelect
          selectedDisk={selectedDisk}
          disks={disks}
          diskError={diskError}
          handleChange={handleDiskChange}
          updateFor={[disks, selectedDisk, diskError, classes]}
          disabled={!canCreateImage}
          required
          data-qa-disk-select
        />
      </Box>
      {isRawDisk ? rawDiskWarning : null}
      <>
        <TextField
          label="Label"
          required
          value={label}
          onChange={changeLabel}
          error={Boolean(labelError)}
          errorText={labelError}
          disabled={!canCreateImage}
          data-qa-image-label
        />
        <TextField
          label="Description"
          multiline
          rows={4}
          value={description}
          onChange={changeDescription}
          error={Boolean(descriptionError)}
          errorText={descriptionError}
          disabled={!canCreateImage}
          data-qa-image-description
        />
      </>

      <Box
        display="flex"
        justifyContent="flex-end"
        alignItems="center"
        flexWrap="wrap"
        className={classes.buttonGroup}
      >
        <Button
          onClick={onSubmit}
          disabled={requirementsMet || !canCreateImage}
          loading={submitting}
          buttonType="primary"
          data-qa-submit
        >
          Create Image
        </Button>
      </Box>
    </Paper>
  );
};

export default compose<Props & ImagesDispatch, Props>(withImages())(
  CreateImageTab
);

const rawDiskWarningText =
  'Using a raw disk may fail, as Linode Images cannot be created from disks formatted with custom filesystems.';
