import { Image } from '@linode/api-v4/lib/images';
import { UserDefinedField } from '@linode/api-v4/lib/stackscripts';
import { assocPath } from 'ramda';
import * as React from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { compose } from 'recompose';
import {
  createStyles,
  Theme,
  withStyles,
  WithStyles,
} from 'src/components/core/styles';
import setDocs, { SetDocsProps } from 'src/components/DocsSidebar/setDocs';
import Grid from 'src/components/Grid';
import ImageSelect from 'src/components/ImageSelect';
import { AppsDocs } from 'src/documentation';
import ImageEmptyState from 'src/features/linodes/LinodesCreate/TabbedContent/ImageEmptyState';
import { AppDetailDrawer } from 'src/features/OneClickApps';
import UserDefinedFieldsPanel from 'src/features/StackScripts/UserDefinedFieldsPanel';
import { ApplicationState } from 'src/store';
import getAPIErrorsFor from 'src/utilities/getAPIErrorFor';
import SelectAppPanel from '../SelectAppPanel';
import {
  AppsData,
  ReduxStateProps,
  StackScriptFormStateHandlers,
  WithTypesRegionsAndImages,
} from '../types';
import { filterUDFErrors } from './formUtilities';
import { APP_ROOT } from 'src/constants';

type ClassNames = 'main' | 'sidebar';

const styles = (theme: Theme) =>
  createStyles({
    sidebar: {
      [theme.breakpoints.up('md')]: {
        marginTop: '-130px !important',
      },
    },
    main: {
      [theme.breakpoints.up('md')]: {
        maxWidth: '100%',
      },
    },
  });

const errorResources = {
  type: 'A plan selection',
  region: 'A region selection',
  label: 'A label',
  root_pass: 'A root password',
  image: 'Image',
  tags: 'Tags',
  stackscript_id: 'The selected App',
};

type InnerProps = AppsData &
  ReduxStateProps &
  StackScriptFormStateHandlers &
  WithTypesRegionsAndImages;

type CombinedProps = WithStyles<ClassNames> &
  InnerProps &
  StateProps &
  SetDocsProps;

interface State {
  detailDrawerOpen: boolean;
  selectedScriptForDrawer: string;
}

class FromAppsContent extends React.PureComponent<CombinedProps, State> {
  state: State = {
    detailDrawerOpen: false,
    selectedScriptForDrawer: '',
  };

  handleSelectStackScript = (
    id: number,
    label: string,
    username: string,
    stackScriptImages: string[],
    userDefinedFields: UserDefinedField[]
  ) => {
    const { imagesData } = this.props;
    /**
     * based on the list of images we get back from the API, compare those
     * to our list of public images supported by Linode and filter out the ones
     * that aren't compatible with our selected StackScript
     */
    const compatibleImages = Object.keys(imagesData).reduce((acc, eachKey) => {
      if (stackScriptImages.some((eachSSImage) => eachSSImage === eachKey)) {
        acc.push(imagesData[eachKey]);
      }

      return acc;
    }, [] as Image[]);

    /**
     * if a UDF field comes back from the API with a "default"
     * value, it means we need to pre-populate the field and form state
     */
    const defaultUDFData = userDefinedFields.reduce((accum, eachField) => {
      if (eachField.default) {
        accum[eachField.name] = eachField.default;
      }
      return accum;
    }, {});

    this.props.updateStackScript(
      id,
      label,
      username,
      userDefinedFields,
      compatibleImages,
      defaultUDFData
    );
  };

  handleChangeUDF = (key: string, value: string) => {
    // either overwrite or create new selection
    const newUDFData = assocPath([key], value, this.props.selectedUDFs);

    this.props.handleSelectUDFs({ ...this.props.selectedUDFs, ...newUDFData });
  };

  openDrawer = (stackScriptLabel: string) => {
    this.setState({
      detailDrawerOpen: true,
      selectedScriptForDrawer: stackScriptLabel,
    });
  };

  closeDrawer = () => {
    this.setState({
      detailDrawerOpen: false,
    });
  };

  render() {
    const {
      classes,
      selectedImageID,
      selectedStackScriptID,
      selectedStackScriptLabel,
      selectedUDFs: udf_data,
      availableUserDefinedFields: userDefinedFields,
      availableStackScriptImages: compatibleImages,
      updateImageID,
      errors,
      appInstances,
      appInstancesError,
      appInstancesLoading,
      userCannotCreateLinode,
    } = this.props;

    const logoUrl = appInstances?.find(
      (app) => app.id === selectedStackScriptID
    )?.logo_url;

    const renderLogo =
      logoUrl === undefined ? (
        <span className="fl-tux" />
      ) : (
        <img
          src={`${APP_ROOT}/${logoUrl}`}
          alt={`${selectedStackScriptLabel} logo`}
        />
      );

    const hasErrorFor = getAPIErrorsFor(errorResources, errors);

    return (
      <React.Fragment>
        <Grid item className={`${classes.main} mlMain py0`}>
          <SelectAppPanel
            appInstances={appInstances}
            appInstancesError={appInstancesError}
            appInstancesLoading={appInstancesLoading}
            selectedStackScriptID={selectedStackScriptID}
            disabled={userCannotCreateLinode}
            handleClick={this.handleSelectStackScript}
            openDrawer={this.openDrawer}
            error={hasErrorFor('stackscript_id')}
          />
          {!userCannotCreateLinode &&
            userDefinedFields &&
            userDefinedFields.length > 0 && (
              <UserDefinedFieldsPanel
                errors={filterUDFErrors(errorResources, errors)}
                selectedLabel={selectedStackScriptLabel || ''}
                selectedUsername="Linode"
                handleChange={this.handleChangeUDF}
                userDefinedFields={userDefinedFields}
                updateFor={[userDefinedFields, udf_data, errors]}
                udf_data={udf_data || {}}
                appLogo={renderLogo}
              />
            )}
          {!userCannotCreateLinode &&
          compatibleImages &&
          compatibleImages.length > 0 ? (
            <ImageSelect
              title="Select an Image"
              images={compatibleImages}
              handleSelectImage={updateImageID}
              selectedImageID={selectedImageID}
              error={hasErrorFor('image')}
              variant="public"
            />
          ) : (
            <ImageEmptyState errorText={hasErrorFor('image')} />
          )}
        </Grid>

        <AppDetailDrawer
          open={this.state.detailDrawerOpen}
          stackScriptLabel={this.state.selectedScriptForDrawer}
          onClose={this.closeDrawer}
        />
      </React.Fragment>
    );
  }
}

const styled = withStyles(styles);

interface StateProps {
  documentation: Linode.Doc[];
}

const mapStateToProps: MapStateToProps<
  StateProps,
  CombinedProps,
  ApplicationState
> = (state) => ({
  documentation: state.documentation,
});

const connected = connect(mapStateToProps);

const generateDocs = (ownProps: InnerProps & StateProps) => {
  const { selectedStackScriptLabel } = ownProps;
  if (!!selectedStackScriptLabel) {
    const foundDocs = AppsDocs.filter((eachDoc) => {
      return eachDoc.title
        .toLowerCase()
        .includes(
          selectedStackScriptLabel
            .substr(0, selectedStackScriptLabel.indexOf(' '))
            .toLowerCase()
        );
    });
    return foundDocs.length ? foundDocs : [];
  }
  return [];
};

const updateCond = (
  prevProps: InnerProps & StateProps,
  nextProps: InnerProps & StateProps
) => {
  return prevProps.selectedStackScriptID !== nextProps.selectedStackScriptID;
};

export default compose<CombinedProps, InnerProps>(
  connected,
  setDocs(generateDocs, updateCond),
  styled
)(FromAppsContent);
