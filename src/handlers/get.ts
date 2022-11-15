import * as AWS from 'aws-sdk';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as UTIL from '../util'
const client = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event: APIGatewayProxyEvent):Promise<APIGatewayProxyResult> => {
    //Get & Set Parameters
    const pathParams = event.pathParameters!
    const queryParams = event.queryStringParameters!
    const status = queryParams['status'] as TECH_STATUS_CODE ?? TECH_STATUS_CODE.PROVISIONAL_OVER_CURRENT;
    const vehicleId = pathParams['vehicleId'];

    const result = await client.query({
        TableName: process.env.target_table!,
        KeyConditionExpression: 'systemNumber = :vehicleId',
        FilterExpression: 'CONTAINS(status, :status)',
        ScanIndexForward: false,
        ExpressionAttributeValues: {
            ':vehicleId': vehicleId,
            ':statusList': status
        }
    }).promise();
    //console.log('Retrieved from Dynamo');

    if (result.Items == undefined || result.Items.length === 0) {
        return {
            statusCode: 404,
            body: '',
        };
    }

    //console.log(JSON.stringify());
    const vehicle = UTIL.unflatten(result.Items);

    const response = {
        statusCode: 200,
        body: JSON.stringify(vehicle),
    };
    return response;
};
