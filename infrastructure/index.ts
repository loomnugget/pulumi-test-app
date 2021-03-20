import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import { TestCloudRunService } from "./cloud-run-service";

const config = new pulumi.Config();
const stackName = pulumi.getStack();
const backendApiDnsName = `api.${stackName}.x.claudiacedfeldtprojects.com`;
const backendUrl = `https://${backendApiDnsName}`;

const secretKeyResource = new random.RandomPassword("rails-secret-key", {
  length: 32,
  lower: true,
  upper: true,
  special: true,
  number: true,
});

const backendService = new TestCloudRunService({
  dockerImage: config.require("backendDockerImage"),
  serviceName: "api",
  dnsName: backendApiDnsName,
  envVars: [
    { name: "SECRET_KEY_BASE", value: secretKeyResource.result }
  ]
});

export const apiBaseUrl = backendService.baseUrl;
