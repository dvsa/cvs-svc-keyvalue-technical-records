import * as AWS from "aws-sdk";
import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyEventQueryStringParameters } from "aws-lambda";
import * as UTIL from "../util";
import { ISearchCriteria } from "../models/searchCriteria";
import { TECH_STATUS_CODE } from "../models/techStatusCode";
const dynamoClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    // Get & Set Parameters
    const queryParams = event.queryStringParameters!;
    const criteriaType = queryParams.searchCriteria as ISearchCriteria;

    const query = getCriteriaClient(dynamoClient, criteriaType, queryParams);
    if(query === undefined) {
        return {
            statusCode:400,
            body:""
        };
    }

    const result = await query.promise();
    // console.log('Retrieved from Dynamo');

    if (result.Items === undefined || result.Items.length === 0) {
        return {
            statusCode: 404,
            body: "",
        };
    }

    // console.log(JSON.stringify());
    const vehicle = UTIL.unflatten(result.Items);

    const response = {
        statusCode: 200,
        body: JSON.stringify(vehicle),
    };
    return response;
};

const getCriteriaClient = (client: AWS.DynamoDB.DocumentClient, criteriaType: ISearchCriteria, queryParams: APIGatewayProxyEventQueryStringParameters): AWS.Request<AWS.DynamoDB.DocumentClient.QueryOutput, AWS.AWSError> | undefined => {
    switch(criteriaType) {
        case ISearchCriteria.VIN:
            return getVinSearch(client, queryParams);
    }
    return undefined;
};

function getVinSearch(client: AWS.DynamoDB.DocumentClient, queryParams: APIGatewayProxyEventQueryStringParameters): AWS.Request<AWS.DynamoDB.DocumentClient.QueryOutput, AWS.AWSError> | undefined {
    const vinNumber = queryParams.vin;
    const status = queryParams.status as TECH_STATUS_CODE ?? TECH_STATUS_CODE.PROVISIONAL_OVER_CURRENT;

    return client.query({
        TableName: process.env.target_table!,
        IndexName: process.env.vin_index!,
        KeyConditionExpression: "vin = :vinNumber",
        FilterExpression: "CONTAINS(status, :status)",
        ScanIndexForward: false,
        ExpressionAttributeValues: {
            ":vinNumber": vinNumber,
            ":statusList": status
        }
    });
}

