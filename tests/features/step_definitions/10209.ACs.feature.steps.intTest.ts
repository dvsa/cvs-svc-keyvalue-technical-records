import {defineFeature, loadFeature} from 'jest-cucumber';
import supertest from "supertest";
import path from 'path';
import mockData from "../../resources/technical-records.json";
import mockContext from "aws-lambda-mock-context";
import {emptyDatabase, populateDatabase} from "../../util/dbOperations";
import {UPDATE_TYPE} from "../../../src/assets/Enums";
import {validatePayload} from "../../../src/utils/PayloadValidation";
import {cloneDeep} from "lodash";

const url = "http://localhost:3005/";
const request = supertest(url);
const opts = Object.assign({
  timeout: 1.5
});

const feature = loadFeature(path.resolve(__dirname, "../10209.ACs.feature"));

defineFeature(feature, test => {
  beforeAll(async () => {
    await emptyDatabase();
  });

  beforeEach(async () => {
    await populateDatabase();
  });

  afterEach(async () => {
    await emptyDatabase();
  });

  afterAll(async () => {
    await populateDatabase();
  });

  test('AC1. GET request: All attributes applicable to HGVs are returned', ({given, when, then, and}) => {
    let ctx: any = mockContext(opts);

    let requestUrl: string;
    let response: any;

    given('I am the vehicles backend service', () => {
      requestUrl = 'vehicles/ABCDEFGH654321/tech-records';
    });
    when('I am called for a HGV, via the GET verb', async () => {
      response = await request.get(requestUrl);
    });
    then('I return all the attributes applicable to HGV, from the linked excel', () => {
      expect(response.status).toEqual(200);
      expect(response.body.techRecord[0].statusCode).toEqual("provisional");
      expect(response.body.techRecord[0]).toHaveProperty("grossEecWeight");
      expect(response.body.techRecord[0]).toHaveProperty("dtpNumber");
      expect(response.body.techRecord[0]).toHaveProperty("make");
      expect(response.body.techRecord[0]).toHaveProperty("model");

    });
    ctx.succeed('done');
    ctx = null;
  });

  test('POST request: HGV vehicle is created, and the appropriate attributes are automatically set', ({given, when, then, and}) => {
    let ctx: any = mockContext(opts);

    let requestUrl: string;
    let response: any;
    let responseGET: any;
    let postPayload: any;

    given('I am the vehicles backend service', () => {
      requestUrl = 'vehicles';
    });
    when('a new HGV vehicle is created via the POST verb', async () => {
      postPayload = createPOSTPayload();
      response = await request.post(requestUrl).send(postPayload);
    });
    then('my POST action adheres to the HGV validations, present in the linked excel, columns D-E', () => {
      expect(response.status).toEqual(201);
    });
    and('the appropriate audit attributes are set on this new tech record', async () => {
      responseGET = await request.get(requestUrl + `/${postPayload.vin}/tech-records`);
      expect(responseGET.body.techRecord[0]).toHaveProperty("createdAt");
      expect(responseGET.body.techRecord[0]).toHaveProperty("createdByName");
      expect(responseGET.body.techRecord[0]).toHaveProperty("createdById");
    });
    and('the \'statusCode\' of this new tech record is always \'provisional\'', () => {
      expect(responseGET.body.techRecord[0].statusCode).toEqual("provisional");
    });
    and('I am able to POST attributes residing anywhere on the vehicle object', () => {
      expect(responseGET.body.techRecord[0].grossEecWeight).toEqual(22);
      expect(responseGET.body.vrms[0].vrm).toEqual("ALKH567");
      expect(responseGET.body.vrms[0].isPrimary).toEqual(true);
    });
    ctx.succeed('done');
    ctx = null;
  });

  test('PUT request: HGV vehicle is updated, and the appropriate attributes are automatically set', ({given, when, then, and}) => {
    let ctx: any = mockContext(opts);

    let requestUrl: string;
    let response: any;
    let responseGET: any;
    let requestUrlGET: string;

    given('I am the vehicles backend service', () => {
      requestUrl = 'vehicles/ABCDEFGH654321';
      requestUrlGET = 'vehicles/ABCDEFGH654321/tech-records?status=all';
    });
    when('an existing HGV vehicle is updated via the PUT verb', async () => {
      const putPayload = createPUTPayload();
      putPayload.techRecord[0].grossEecWeight = 33;
      response = await request.put(requestUrl).send(putPayload);
      responseGET = await request.get(requestUrlGET);
    });
    then('my PUT action adheres to the HGV validations, present in the linked excel, columns D-E', () => {
      expect(response.status).toEqual(200);
      expect(response.body.techRecord.length).toEqual(2);
    });
    and('a new identical tech record is created, with the same status, and the updated attributes on it', () => {
      expect(response.body.techRecord[1].statusCode).toEqual("provisional");
      expect(response.body.techRecord[1].grossEecWeight).toEqual(33);
    });
    and('the previous "pre-update" tech record still exists in DynamoDB, with it\'s status set to archived', () => {
      expect(response.body.techRecord[0].statusCode).toEqual("archived");
    });
    and('the appropriate audit attributes are set on the new updated tech record', () => {
      expect(responseGET.body.techRecord[1]).toHaveProperty("createdAt");
      expect(responseGET.body.techRecord[1]).toHaveProperty("createdByName");
      expect(responseGET.body.techRecord[1]).toHaveProperty("createdById");
    });
    and('I am only able to update attributes within the techRecord[] array', () => {
      expect(response.body.vrms.length).toEqual(2);
      expect(response.body.vrms[0].vrm).toEqual("LKJH654");
      expect(response.body.vrms[0].isPrimary).toEqual(true);
      expect(response.body.vrms[1].vrm).toEqual("POI9876");
      expect(response.body.vrms[1].isPrimary).toEqual(false);
    });
    ctx.succeed('done');
    ctx = null;
  });
});

const createPUTPayload = () => {
  const techRec: any = cloneDeep(mockData[43]);
  delete techRec.techRecord[0].statusCode;
  const payload = {
    msUserDetails: {
      msUser: "dorel",
      msOid: "1234545"
    },
    primaryVrm: "ALKH567",
    secondaryVrms: ["POI9876", "YYY9876"],
    techRecord: techRec.techRecord
  };
  return payload;
};

const createPOSTPayload = () => {
  const techRec: any = cloneDeep(mockData[43]);
  techRec.techRecord[0].grossEecWeight = 22;
  delete techRec.techRecord[0].statusCode;
  const payload = {
    msUserDetails: {
      msUser: "dorel",
      msOid: "1234545"
    },
    vin: Date.now().toString(),
    primaryVrm: "ALKH567",
    techRecord: techRec.techRecord
  };
  return payload;
};
