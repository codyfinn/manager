import { UserDefinedField } from '@linode/api-v4/lib/stackscripts';
import { APIError } from '@linode/api-v4/lib/types';
import * as React from 'react';
import { compose } from 'recompose';
import Paper from 'src/components/core/Paper';
import {
  createStyles,
  Theme,
  withStyles,
  WithStyles,
} from 'src/components/core/styles';
import Typography from 'src/components/core/Typography';
import Grid from 'src/components/Grid';
import Box from 'src/components/core/Box';
import RenderGuard, { RenderGuardProps } from 'src/components/RenderGuard';
import ShowMoreExpansion from 'src/components/ShowMoreExpansion';
import UserDefinedMultiSelect from './FieldTypes/UserDefinedMultiSelect';
import UserDefinedSelect from './FieldTypes/UserDefinedSelect';
import UserDefinedText from './FieldTypes/UserDefinedText';
import AppInfo from '../../linodes/LinodesCreate/AppInfo';
import classnames from 'classnames';

type ClassNames =
  | 'root'
  | 'username'
  | 'advDescription'
  | 'optionalFieldWrapper'
  | 'header'
  | 'marketplaceSpacing';

const styles = (theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(3),
      marginBottom: theme.spacing(3),
      '& > div:last-child': {
        border: 0,
        marginBottom: 0,
        paddingBottom: 0,
      },
    },
    advDescription: {
      margin: `${theme.spacing(2)}px 0`,
    },
    username: {
      color: theme.color.grey1,
    },
    optionalFieldWrapper: {},
    header: {
      display: 'flex',
      alignItems: 'center',
      columnGap: theme.spacing(),
      '& > img': {
        width: 60,
        height: 60,
      },
    },
    marketplaceSpacing: {
      paddingTop: theme.spacing(),
      paddingBottom: theme.spacing(),
    },
  });

interface Props {
  errors?: APIError[];
  userDefinedFields?: UserDefinedField[];
  handleChange: (key: string, value: any) => void;
  udf_data: any;
  selectedLabel: string;
  selectedUsername: string;
  appLogo?: JSX.Element;
  openDrawer?: (stackScriptLabel: string) => void;
}

type CombinedProps = Props & WithStyles<ClassNames>;

class UserDefinedFieldsPanel extends React.PureComponent<CombinedProps> {
  renderField = (field: UserDefinedField, error?: string) => {
    const { udf_data, handleChange } = this.props;
    // if the 'default' key is returned from the API, the field is optional
    const isOptional = field.hasOwnProperty('default');

    if (isMultiSelect(field)) {
      return (
        <Grid item xs={12} lg={5} key={field.name}>
          <UserDefinedMultiSelect
            key={field.name}
            field={field}
            value={udf_data[field.name] || ''}
            updateFormState={handleChange}
            updateFor={[field.label, udf_data[field.name], error]}
            isOptional={isOptional}
            error={error}
          />
        </Grid>
      );
    }
    if (isOneSelect(field)) {
      return (
        <Grid item xs={12} lg={5} key={field.name}>
          <UserDefinedSelect
            field={field}
            updateFormState={handleChange}
            value={udf_data[field.name] || ''}
            updateFor={[field.label, udf_data[field.name], error]}
            isOptional={isOptional}
            key={field.name}
            error={error}
          />{' '}
        </Grid>
      );
    }
    if (isPasswordField(field.name)) {
      return (
        <Grid item xs={12} lg={5} key={field.name}>
          <UserDefinedText
            /**
             * we explicitly passing the value to solve for the situation
             * where you're switching between stackscripts or one-click-apps
             * and the same UDF with the same label appears in both stackscripts.
             *
             * The problem here is that unless we explicitly pass the value,
             * the form state will be reset but because MUI handles the
             * value internally, the pre-inputted value will still exist in the
             * textfield
             *
             * To test the incorrect behavior, try removing the "value" prop here,
             * navigate to the One-Click app creation flow, click on MERN, fill out
             * a DB password, then switch to LAMP. You'll see the value will
             * still be in the form field.
             *
             * This comment is wordy as heck but it's important that we never remove this
             * prop or that bug will return
             */
            value={udf_data[field.name] || ''}
            updateFormState={handleChange}
            isPassword={true}
            field={field}
            updateFor={[field.label, udf_data[field.name], error]}
            isOptional={isOptional}
            placeholder={field.example}
            error={error}
          />
        </Grid>
      );
    }
    return (
      <Grid item xs={12} lg={5} key={field.name}>
        <UserDefinedText
          /** see comment above for why we're passing the value prop */
          value={udf_data[field.name] || ''}
          updateFormState={handleChange}
          field={field}
          updateFor={[field.label, udf_data[field.name], error]}
          isOptional={isOptional}
          placeholder={field.example}
          error={error}
        />
      </Grid>
    );
  };

  handleOpenDrawer = () => {
    this.props.openDrawer !== undefined
      ? this.props.openDrawer(this.props.selectedLabel)
      : undefined;
  };

  render() {
    const { userDefinedFields, classes } = this.props;

    const [requiredUDFs, optionalUDFs] = seperateUDFsByRequiredStatus(
      userDefinedFields!
    );

    return (
      <Paper
        className={classnames(classes.root, {
          [`${classes.marketplaceSpacing}`]:
            this.props.openDrawer !== undefined,
        })}
      >
        <Box className={classes.header}>
          {this.props.appLogo}
          <Typography variant="h2" data-qa-user-defined-field-header>
            <span>{`${this.props.selectedLabel} Setup`}</span>
          </Typography>
          {this.props.openDrawer ? (
            <AppInfo onClick={this.handleOpenDrawer} />
          ) : null}
        </Box>

        {/* Required Fields */}
        {requiredUDFs.map((field: UserDefinedField) => {
          const error = getError(field, this.props.errors);
          return this.renderField(field, error);
        })}

        {/* Optional Fields */}
        {optionalUDFs.length !== 0 && (
          <ShowMoreExpansion name="Advanced Options" defaultExpanded={true}>
            <Typography variant="body1" className={classes.advDescription}>
              These fields are additional configuration options and are not
              required for creation.
            </Typography>
            <div
              className={`${classes.optionalFieldWrapper} optionalFieldWrapper`}
            >
              {optionalUDFs.map((field: UserDefinedField) => {
                const error = getError(field, this.props.errors);
                return this.renderField(field, error);
              })}
            </div>
          </ShowMoreExpansion>
        )}
      </Paper>
    );
  }
}

const getError = (field: UserDefinedField, errors?: APIError[]) => {
  if (!errors) {
    return;
  }
  const error = errors.find((thisError) => thisError.field === field.name);
  return error ? error.reason.replace('the UDF', '') : undefined;
};

const isPasswordField = (udfName: string) => {
  return udfName.toLowerCase().includes('password');
};

const isOneSelect = (udf: UserDefinedField) => {
  return !!udf.oneof; // if we have a oneof prop, it's a radio button
};

const isMultiSelect = (udf: UserDefinedField) => {
  return !!udf.manyof; // if we have a manyof prop, it's a checkbox
};

/**
 * Used to separate required UDFs from non-required ones
 *
 * @return nested array [[...requiredUDFs], [...nonRequiredUDFs]]
 */
const seperateUDFsByRequiredStatus = (udfs: UserDefinedField[]) => {
  return udfs.reduce(
    (accum, eachUDF) => {
      /**
       * if the "default" key exists, it's optional
       */
      if (eachUDF.hasOwnProperty('default')) {
        return [[...accum[0]], [...accum[1], eachUDF]];
      } else {
        return [[...accum[0], eachUDF], [...accum[1]]];
      }
    },
    [[], []]
  );
};

const styled = withStyles(styles);

export default compose<CombinedProps, Props & RenderGuardProps>(
  RenderGuard,
  styled
)(UserDefinedFieldsPanel);
