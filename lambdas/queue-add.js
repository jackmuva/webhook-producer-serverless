import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const cognito = new CognitoIdentityProviderClient({});
const dynamo = DynamoDBDocument.from(new DynamoDB());

const sqs = new SQSClient({ region: process.env.region });

export const handler = async (event) => {
    const user = await getUser(event.headers.accessToken);
    const endpointObjects = await getAllUserEndpoints(user.Username);

    const responses = [];

    for (const endpointObject of endpointObjects) {
        const res = await sendMessage(endpointObject.endpoint, endpointObject.user_id,
            endpointObject.key_location, endpointObject.endpoint_id,
            event.message_id, event.message);
        responses.push(res);
    }

    return responses;
};

async function getAllUserEndpoints(userId){
    let params = {
        FilterExpression : 'user_id = :userId',
        ExpressionAttributeValues : {':userId' : userId},
        TableName: process.env.db_name
    };

    const response = await dynamo.scan(params);

    return response.Items;
}

async function getUser(accessToken) {
    const input = {
        AccessToken: accessToken,
    };
    const command = new GetUserCommand(input);
    const response = await cognito.send(command);

    return response;
};

async function sendMessage(endpoint, user_id, key_location, endpoint_id, message_id, message){
    const params = {
        MessageAttributes: {
            endpoint: {
                DataType: "String",
                StringValue: endpoint,
            },
            user_id: {
                DataType: "String",
                StringValue: user_id,
            },
            key_location: {
                DataType: "String",
                StringValue: key_location,
            },
        },
        MessageBody: message,
        MessageDeduplicationId:  endpoint_id,  // Required for FIFO queues
        MessageGroupId:  message_id,  // Required for FIFO queues
        QueueUrl: process.env.queueUrl,
    };

    const command = new SendMessageCommand(params);
    const response = await sqs.send(command);

    console.log(response);

    return response;
};
