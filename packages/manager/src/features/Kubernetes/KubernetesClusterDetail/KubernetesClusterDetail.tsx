import {
  getKubeConfig,
  getKubernetesClusterEndpoints,
  KubernetesEndpointResponse,
  recycleAllNodes,
  recycleClusterNodes,
  recycleNode,
  updateKubernetesCluster,
} from '@linode/api-v4/lib/kubernetes';
import { APIError } from '@linode/api-v4/lib/types';
import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { compose } from 'recompose';
import Breadcrumb from 'src/components/Breadcrumb';
import Button from 'src/components/Button';
import CircleProgress from 'src/components/CircleProgress';
import Grid from 'src/components/core/Grid';
import { makeStyles, Theme } from 'src/components/core/styles';
import DocsLink from 'src/components/DocsLink';
import { DocumentTitleSegment } from 'src/components/DocumentTitle';
import ErrorState from 'src/components/ErrorState';
import { HIGH_AVAILABILITY_PRICE } from 'src/constants';
import KubeContainer, {
  DispatchProps,
} from 'src/containers/kubernetes.container';
import withTypes, { WithTypesProps } from 'src/containers/types.container';
import { useDialog } from 'src/hooks/useDialog';
import useFlags from 'src/hooks/useFlags';
import usePolling from 'src/hooks/usePolling';
import { useAccount } from 'src/queries/account';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import { getAllWithArguments } from 'src/utilities/getAll';
import { ExtendedCluster, PoolNodeWithPrice } from '.././types';
import KubeSummaryPanel from './KubeSummaryPanel';
import NodePoolsDisplay from './NodePoolsDisplay';
import UpgradeClusterDialog from './UpgradeClusterDialog';
import UpgradeKubernetesVersionBanner from './UpgradeKubernetesVersionBanner';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    [theme.breakpoints.down('sm')]: {
      paddingRight: theme.spacing(),
    },
    [theme.breakpoints.down('xs')]: {
      paddingLeft: theme.spacing(),
    },
  },
  error: {
    [theme.breakpoints.down('xs')]: {
      paddingBottom: 20,
    },
  },
  upgradeToHAButton: {
    marginLeft: 24,
  },
}));
interface KubernetesContainerProps {
  cluster: ExtendedCluster | null;
  clustersLoading: boolean;
  clustersLoadError?: APIError[];
  clusterDeleteError?: APIError[];
  lastUpdated: number;
  nodePoolsLoading: boolean;
}

type CombinedProps = WithTypesProps &
  RouteComponentProps<{ clusterID: string }> &
  KubernetesContainerProps &
  DispatchProps;

const getAllEndpoints = getAllWithArguments<KubernetesEndpointResponse>(
  getKubernetesClusterEndpoints
);

export const KubernetesClusterDetail: React.FunctionComponent<CombinedProps> = (
  props
) => {
  const classes = useStyles();
  const flags = useFlags();
  const { data: account } = useAccount();

  const {
    cluster,
    clustersLoadError,
    clustersLoading,
    lastUpdated,
    location,
  } = props;

  const [endpoint, setEndpoint] = React.useState<string | null>(null);
  const [endpointError, setEndpointError] = React.useState<string | undefined>(
    undefined
  );
  const [endpointLoading, setEndpointLoading] = React.useState<boolean>(false);

  const [updateError, setUpdateError] = React.useState<string | undefined>();

  const [
    kubeconfigAvailable,
    setKubeconfigAvailability,
  ] = React.useState<boolean>(false);
  const [kubeconfigError, setKubeconfigError] = React.useState<
    string | undefined
  >(undefined);

  const endpointAvailabilityInterval = React.useRef<number>();
  const kubeconfigAvailabilityInterval = React.useRef<number>();

  usePolling([() => props.requestNodePools(+props.match.params.clusterID)]);

  const getEndpointToDisplay = (endpoints: string[]) => {
    // Per discussions with the API team and UX, we should display only the endpoint with port 443, so we are matching on that.
    return endpoints.find((thisResponse) =>
      thisResponse.match(/linodelke\.net:443$/i)
    );
  };

  const successfulClusterEndpointResponse = (endpoints: string[]) => {
    setEndpointError(undefined);

    const endpointToDisplay = getEndpointToDisplay(endpoints);

    setEndpoint(endpointToDisplay ?? null);
    setEndpointLoading(false);
    clearInterval(endpointAvailabilityInterval.current);
  };

  // Create a function to check if the Kubeconfig is available.
  const kubeconfigAvailabilityCheck = (
    clusterID: number,
    startInterval: boolean = false
  ) => {
    getKubeConfig(clusterID)
      .then(() => {
        kubeconfigAvailableEndInterval();
      })
      .catch((error) => {
        if (startInterval) {
          setKubeconfigAvailability(false);

          if (error?.[0]?.reason.match(/not yet available/i)) {
            // If it is not yet available, set kubeconfigAvailabilityInterval equal to function that continues polling the endpoint every 30 seconds to grab it when it is
            kubeconfigAvailabilityInterval.current = window.setInterval(() => {
              kubeconfigAvailabilityCheck(clusterID);
            }, 30 * 1000);
          } else {
            setKubeconfigError(
              getAPIErrorOrDefault(error, 'Kubeconfig not available.')[0].reason
            );
          }
        }
      });
  };

  const kubeconfigAvailableEndInterval = () => {
    setKubeconfigAvailability(true);
    clearInterval(kubeconfigAvailabilityInterval.current);
  };

  React.useEffect(() => {
    const clusterID = +props.match.params.clusterID;
    if (clusterID) {
      // A function to check if the endpoint is available.
      const endpointAvailabilityCheck = () => {
        getAllEndpoints([clusterID])
          .then((response) => {
            successfulClusterEndpointResponse(
              response.data.map((thisEndpoint) => thisEndpoint.endpoint)
            );
          })
          .catch((_error) => {
            // Do nothing since endpoint is null by default, and in the instances where this function is called, endpointAvailabilityInterval has been set in motion already.
          });
      };

      props.requestClusterForStore(clusterID).catch((_) => null); // Handle in Redux
      // The cluster endpoint has its own API...uh, endpoint, so we need
      // to request it separately.
      setEndpointLoading(true);
      getAllEndpoints([clusterID])
        .then((response) => {
          successfulClusterEndpointResponse(
            response.data.map((thisEndpoint) => thisEndpoint.endpoint)
          );
        })
        .catch((error) => {
          setEndpointLoading(false);

          // If the error is that the endpoint is not yet available, set endpointAvailabilityInterval equal to function that continues polling the endpoint every 5 seconds to grab it when it is.
          if (error?.[0]?.reason.match(/endpoints are not yet available/i)) {
            endpointAvailabilityInterval.current = window.setInterval(() => {
              endpointAvailabilityCheck();
            }, 5000);
          } else {
            setEndpointError(
              getAPIErrorOrDefault(error, 'Cluster endpoint not available.')[0]
                .reason
            );
          }
        });

      kubeconfigAvailabilityCheck(clusterID, true);
    }

    return () => {
      clearInterval(endpointAvailabilityInterval.current);
      clearInterval(kubeconfigAvailabilityInterval.current);
    };
  }, []);

  const _updateCluster = (clusterId: number) =>
    updateKubernetesCluster(clusterId, {
      control_plane: { high_availability: true },
    });

  const {
    dialog: upgradeDialog,
    closeDialog: closeUpgradeDialog,
    openDialog: openUpgradeDialog,
  } = useDialog(_updateCluster);

  const capabilities = account?.capabilities ?? [];
  const isHighAvailabilityFeatureEnabled =
    HIGH_AVAILABILITY_PRICE !== undefined &&
    capabilities.includes('LKE HA Control Planes');

  const isClusterHighlyAvailable =
    isHighAvailabilityFeatureEnabled &&
    cluster?.control_plane?.high_availability;

  if (clustersLoadError) {
    const error = getAPIErrorOrDefault(
      clustersLoadError,
      'Unable to load cluster data.'
    )[0].reason;
    return <ErrorState errorText={error} />;
  }

  if (
    (clustersLoading && lastUpdated === 0) ||
    props.nodePoolsLoading ||
    props.typesLoading
  ) {
    return <CircleProgress />;
  }

  if (cluster === null) {
    return null;
  }

  const handleLabelChange = (newLabel: string) => {
    setUpdateError(undefined);

    return props
      .updateCluster({ clusterID: cluster.id, label: newLabel })
      .catch((e) => {
        setUpdateError(e[0].reason);
        return Promise.reject(e);
      });
  };

  const resetEditableLabel = () => {
    setUpdateError(undefined);
    return cluster.label;
  };

  const handleRecycleAllPoolNodes = (nodePoolID: number) => {
    return recycleAllNodes(cluster.id, nodePoolID).then((response) => {
      // Recycling nodes is an asynchronous process, and it probably won't make a difference to
      // request Node Pools here (it could be several seconds before statuses change). I thought
      // it was a good idea anyway, though.
      props.requestNodePools(cluster.id);
      return response;
    });
  };

  const handleRecycleNode = (nodeID: string) => {
    return recycleNode(cluster.id, nodeID);
  };

  const handleRecycleAllClusterNodes = () => recycleClusterNodes(cluster.id);

  return (
    <>
      <DocumentTitleSegment segment={`Kubernetes Cluster ${cluster.label}`} />
      <Grid item>
        <UpgradeKubernetesVersionBanner
          clusterID={cluster.id}
          clusterLabel={cluster.label}
          currentVersion={cluster.k8s_version}
        />
      </Grid>
      <Grid container className={classes.root} justifyContent="space-between">
        <Grid item className="p0">
          <Breadcrumb
            onEditHandlers={{
              editableTextTitle: cluster.label,
              onEdit: handleLabelChange,
              onCancel: resetEditableLabel,
              errorText: updateError,
            }}
            firstAndLastOnly
            pathname={location.pathname}
            data-qa-breadcrumb
          />
        </Grid>
        <Grid
          item
          className="p0"
          style={{ marginTop: 14, marginBottom: 8, display: 'flex' }}
        >
          <DocsLink href="https://www.linode.com/docs/kubernetes/deploy-and-manage-a-cluster-with-linode-kubernetes-engine-a-tutorial/" />
          {isHighAvailabilityFeatureEnabled && !isClusterHighlyAvailable ? (
            <Button
              className={classes.upgradeToHAButton}
              buttonType="primary"
              onClick={() => openUpgradeDialog(cluster.id)}
            >
              Upgrade to HA
            </Button>
          ) : null}
        </Grid>
      </Grid>
      <Grid item xs={12}>
        <KubeSummaryPanel
          cluster={cluster}
          endpoint={endpoint}
          endpointError={endpointError}
          endpointLoading={endpointLoading}
          kubeconfigAvailable={kubeconfigAvailable}
          kubeconfigError={kubeconfigError}
          handleUpdateTags={(newTags: string[]) =>
            props.updateCluster({
              clusterID: cluster.id,
              tags: newTags,
            })
          }
          isClusterHighlyAvailable={
            isHighAvailabilityFeatureEnabled &&
            cluster.control_plane.high_availability
          }
          isKubeDashboardFeatureEnabled={Boolean(
            flags.kubernetesDashboardAvailability
          )}
        />
      </Grid>
      <Grid item xs={12}>
        <NodePoolsDisplay
          clusterID={cluster.id}
          clusterLabel={cluster.label}
          pools={cluster.node_pools}
          types={props.typesData || []}
          addNodePool={(pool: PoolNodeWithPrice) =>
            props.createNodePool({
              clusterID: cluster.id,
              type: pool.type,
              count: pool.count,
            })
          }
          updatePool={(id: number, updatedPool: PoolNodeWithPrice) =>
            props.updateNodePool({
              clusterID: cluster.id,
              nodePoolID: id,
              type: updatedPool.type,
              count: updatedPool.count,
            })
          }
          deletePool={(poolID: number) =>
            props.deleteNodePool({
              clusterID: cluster.id,
              nodePoolID: poolID,
            })
          }
          recycleAllPoolNodes={(poolID: number) =>
            handleRecycleAllPoolNodes(poolID)
          }
          recycleNode={handleRecycleNode}
          recycleAllClusterNodes={handleRecycleAllClusterNodes}
          getNodePools={() =>
            props.requestNodePools(+props.match.params.clusterID)
          }
        />
      </Grid>
      <UpgradeClusterDialog
        open={upgradeDialog.isOpen}
        onClose={closeUpgradeDialog}
        clusterID={cluster.id}
      />
    </>
  );
};

const withCluster = KubeContainer<
  {},
  WithTypesProps & RouteComponentProps<{ clusterID: string }>
>(
  (
    ownProps,
    clustersLoading,
    lastUpdated,
    clustersError,
    clustersData,
    nodePoolsLoading
  ) => {
    const cluster =
      clustersData.find((c) => +c.id === +ownProps.match.params.clusterID) ||
      null;
    return {
      ...ownProps,
      cluster,
      lastUpdated,
      clustersLoading,
      clustersLoadError: clustersError.read,
      clusterDeleteError: clustersError.delete,
      nodePoolsLoading,
    };
  }
);

const enhanced = compose<CombinedProps, RouteComponentProps>(
  withTypes,
  withCluster
);

export default enhanced(KubernetesClusterDetail);
