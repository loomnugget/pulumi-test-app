import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
type EnvVarSpec = {
    name: pulumi.Input<string>;
    value: pulumi.Input<string>;
};
export type CloudRunServiceArgs = {
  dockerImage: string;
  serviceName: string;
  envVars?: pulumi.Input<EnvVarSpec[]>;
  dnsName: string;
}
export class TestCloudRunService {
  baseUrl: pulumi.Output<string>;
  constructor(args: CloudRunServiceArgs) {
    const cloudRunService = new gcp.cloudrun.Service(`${args.serviceName}-cr`, {
      traffics: [{
        percent: 100,
        latestRevision: true
      }],
      location: "us-west1",
      template: {
        metadata: {
          annotations: {
            "autoscaling.knative.dev/maxScale": "1",
          }
        },
        spec: {
          containers: [{
            image: args.dockerImage,
            ...args.envVars ? {
              envs: args.envVars
            } : {},
          }]
        }
      }
    });
    var binding = new gcp.cloudrun.IamBinding(`${args.serviceName}-iam-public`, {
      members: ["allUsers"],
      role: "roles/run.invoker",
      service: cloudRunService.name,
      location: cloudRunService.location,
    });
    const group = new gcp.compute.RegionNetworkEndpointGroup(`${args.serviceName}-epg`, {
      networkEndpointType: "SERVERLESS",
      region: cloudRunService.location,
      cloudRun: {
        service: cloudRunService.name
      }
    });
    const backendService = new gcp.compute.BackendService(`${args.serviceName}-bksvc`, {
      backends: [{
        group: group.id
      }]
    });
    const dnsName = `${args.dnsName}.`;
    const cert = new gcp.compute.ManagedSslCertificate(`${args.serviceName}-cert`, {
      managed: {
        domains: [dnsName]
      }
    });
    const urlMap = new gcp.compute.URLMap(`${args.serviceName}-urlmap`, {
      defaultService: backendService.id
    });
    const httpsProxy = new gcp.compute.TargetHttpsProxy(`${args.serviceName}-httpsproxy`, {
      sslCertificates: [cert.name],
      urlMap: urlMap.name,
    });
    const forwardingRule = new gcp.compute.GlobalForwardingRule(`${args.serviceName}-fwdrule`, {
      target: httpsProxy.id,
      loadBalancingScheme: "EXTERNAL",
      portRange: "443",
    });
    const dnsRecord = new gcp.dns.RecordSet(`${args.serviceName}-dnsrec`, {
      managedZone: "x-claudia-cedfeldt-projects",
      rrdatas: [forwardingRule.ipAddress],
      type: "A",
      name: dnsName,
      ttl: 300,
    });
    // trim the trailing dot
    this.baseUrl = dnsRecord.name.apply(x => x.substr(0, x.length - 1));
  }
}
