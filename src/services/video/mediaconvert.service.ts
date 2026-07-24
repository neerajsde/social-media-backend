import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
} from "@aws-sdk/client-mediaconvert";
import { ENV } from "../../config/env.js";

export async function getMediaConvertClient() {
  if (!ENV.AWS_MEDIACONVERT_ENDPOINT || !ENV.AWS_MEDIACONVERT_ROLE_ARN) {
    throw new Error("AWS MediaConvert variables are not configured in .env");
  }

  return new MediaConvertClient({
    region: ENV.AWS_REGION,
    endpoint: ENV.AWS_MEDIACONVERT_ENDPOINT,
    credentials: {
      accessKeyId: ENV.AWS_ACCESS_KEY_ID,
      secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export async function createMediaConvertJob(
  inputKey: string,
  outputPrefix: string
): Promise<string> {
  const client = await getMediaConvertClient();
  const bucket = ENV.S3_BUCKET_NAME;

  const inputUri = `s3://${bucket}/${inputKey}`;
  const outputUri = `s3://${bucket}/${outputPrefix}/index`; // Appending 'index' sets the base filename to index.m3u8

  const command = new CreateJobCommand({
    Role: ENV.AWS_MEDIACONVERT_ROLE_ARN,
    Settings: {
      TimecodeConfig: {
        Source: "ZEROBASED",
      },
      OutputGroups: [
        {
          Name: "Apple HLS",
          OutputGroupSettings: {
            Type: "HLS_GROUP_SETTINGS",
            HlsGroupSettings: {
              SegmentLength: 6,
              MinSegmentLength: 0,
              Destination: outputUri,
            },
          },
          Outputs: [
            {
              NameModifier: "360p",
              ContainerSettings: {
                Container: "M3U8",
                M3u8Settings: {},
              },
              VideoDescription: {
                CodecSettings: {
                  Codec: "H_264",
                  H264Settings: {
                    MaxBitrate: 800000,
                    RateControlMode: "QVBR",
                    QvbrSettings: { QvbrQualityLevel: 7 },
                  },
                },
                Height: 360, // Calculate width dynamically to prevent padding
              },
              AudioDescriptions: [
                {
                  CodecSettings: {
                    Codec: "AAC",
                    AacSettings: {
                      Bitrate: 96000,
                      CodingMode: "CODING_MODE_2_0",
                      SampleRate: 48000,
                    },
                  },
                },
              ],
            },
            {
              NameModifier: "720p",
              ContainerSettings: {
                Container: "M3U8",
                M3u8Settings: {},
              },
              VideoDescription: {
                CodecSettings: {
                  Codec: "H_264",
                  H264Settings: {
                    MaxBitrate: 2800000,
                    RateControlMode: "QVBR",
                    QvbrSettings: { QvbrQualityLevel: 7 },
                  },
                },
                Height: 720, // Calculate width dynamically to prevent padding
              },
              AudioDescriptions: [
                {
                  CodecSettings: {
                    Codec: "AAC",
                    AacSettings: {
                      Bitrate: 128000,
                      CodingMode: "CODING_MODE_2_0",
                      SampleRate: 48000,
                    },
                  },
                },
              ],
            },
            {
              NameModifier: "1080p",
              ContainerSettings: {
                Container: "M3U8",
                M3u8Settings: {},
              },
              VideoDescription: {
                CodecSettings: {
                  Codec: "H_264",
                  H264Settings: {
                    MaxBitrate: 5000000,
                    RateControlMode: "QVBR",
                    QvbrSettings: { QvbrQualityLevel: 8 },
                  },
                },
                Height: 1080, // Calculate width dynamically to prevent padding
              },
              AudioDescriptions: [
                {
                  CodecSettings: {
                    Codec: "AAC",
                    AacSettings: {
                      Bitrate: 192000,
                      CodingMode: "CODING_MODE_2_0",
                      SampleRate: 48000,
                    },
                  },
                },
              ],
            },
            {
              NameModifier: "1440p",
              ContainerSettings: {
                Container: "M3U8",
                M3u8Settings: {},
              },
              VideoDescription: {
                CodecSettings: {
                  Codec: "H_264",
                  H264Settings: {
                    MaxBitrate: 8000000,
                    RateControlMode: "QVBR",
                    QvbrSettings: { QvbrQualityLevel: 8 },
                  },
                },
                Height: 1440, // Calculate width dynamically to prevent padding
              },
              AudioDescriptions: [
                {
                  CodecSettings: {
                    Codec: "AAC",
                    AacSettings: {
                      Bitrate: 192000,
                      CodingMode: "CODING_MODE_2_0",
                      SampleRate: 48000,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
      Inputs: [
        {
          AudioSelectors: {
            "Audio Selector 1": {
              DefaultSelection: "DEFAULT",
            },
          },
          VideoSelector: {},
          TimecodeSource: "ZEROBASED",
          FileInput: inputUri,
        },
      ],
    },
  });

  const response = await client.send(command);
  return response.Job?.Id || "";
}

export async function getMediaConvertJob(jobId: string) {
  const client = await getMediaConvertClient();
  const command = new GetJobCommand({ Id: jobId });
  const response = await client.send(command);
  return response.Job;
}
