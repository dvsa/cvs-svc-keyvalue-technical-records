import * as AWS from 'aws-sdk';
import logger from './logger';
import _ from 'lodash';
import { HeavyGoodsVehicle, HgvTechRecord, TechRecord, Vehicle } from './models/techRecordTypes';
import { any } from '@hapi/joi';

export interface NewKeyStructure {
  [index: string]: string | boolean | number | Array<string>;
}

interface LegacyKeyStructure {
  [index: string]: string | boolean | number | Array<string> | Array<LegacyKeyStructure> | LegacyKeyStructure;
}

interface LegacyTechRecord {
  systemNumber: string,
  vin: string,
  primaryVrm: string,
  partialVin: string,
  trailerID?: string,
  secondaryVrms: string[]
  techRecord: SingleTechRecord[]
}

interface SingleTechRecord extends LegacyKeyStructure {
  createdAt: string;
}

export { SingleTechRecord, LegacyTechRecord, LegacyKeyStructure };

const isValidValue = (a: unknown) => {
  return a !== null && a !== undefined && (_.isString(a) || _.isNumber(a) || _.isBoolean(a));
};

const flattenAttributes = (vehicle: NewKeyStructure, recordPiece: object, prefix: string) => {
  if (recordPiece === null || recordPiece === undefined) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  for (const [key, value] of Object.entries(recordPiece)) {
    if (value === null || value === undefined) {
      logger.debug(`skipping ${key}`);
      continue;
    }
    const fullKey = `${prefix}_${key}`;

    if (_.isObject(value)) {
      if (_.isArray(value)) {
        value.forEach((arrItem, index) => {
          if (_.isObject(arrItem)) {
            flattenAttributes(vehicle, arrItem, `${fullKey}_${index}`);
          } else if (isValidValue(arrItem)) {
            vehicle[`${fullKey}_${index}`] = arrItem as string | boolean | number;
          }
        });
      } else {
        flattenAttributes(vehicle, value, fullKey);
      }
    } else if (isValidValue(value)) {
      vehicle[fullKey.toString()] = value as string | boolean | number;
    }
  }

  return vehicle;
};

export const createTimestampRecord = (newImage: LegacyTechRecord, record: SingleTechRecord) => {
  const vehicle: NewKeyStructure = {
    systemNumber: newImage.systemNumber,
    createdTimestamp: record.createdAt,
  };

  for (const [key, value] of Object.entries(newImage)) {
    if (key !== 'techRecord' && isValidValue(key)) {
      vehicle[key.toString()] = value as string | boolean | number;
    }
  }

  logger.info('flattening techRecord');
  return flattenAttributes(vehicle, record, 'techRecord');
};

export const unflatten = (items: AWS.DynamoDB.DocumentClient.ItemList): Vehicle[] => {
  const vehicles: Vehicle[] = [];
  let techRecords: TechRecord[] = [];
  let previousVehicle: Vehicle | undefined = undefined;

  for (const item of items) {
    const vehicle: any = {};
    const record: any = {};
    for (const [key, value] of Object.entries(item)) {
      if (key.indexOf('_') === -1 && !vehicle[key]) {
        vehicle[key] = value;
        continue;
      }
      nestItem(record, key, value, 0);
    }

    if (previousVehicle !== undefined && previousVehicle.systemNumber !== vehicle.systemNumber) {
      vehicle.techRecords = techRecords;
      techRecords = [];
      vehicles.push(vehicle);
    }

    techRecords.push(record.techRecord);
    previousVehicle = vehicle;
  }

  if (previousVehicle !== undefined) {
    //TODO: Check this vehicle typing - is it required for GET or is this a validation necessity we should ignore everywhere else?
    (previousVehicle as HeavyGoodsVehicle).techRecord = techRecords as HgvTechRecord[];
    vehicles.push(previousVehicle);
  }

  return vehicles;
}

const nestItem = (record: { [key: string]: any }, key: string, value: any, position: number) => {
  const idx = key.indexOf('_', position);

  if (idx === -1) {
    //console.log(`Setting ${key.substr(position)}`);
    record[key.substring(position)] = value;
    return;
  }
  const realKey = key.substring(position, idx - position);
  //console.log(`Dealing with ${realKey}`);
  const isArray = !isNaN(parseInt(key[idx + 1]));
  //console.log(`key: ${realKey}, isArray: ${isArray}`);

  if (!record[realKey]) {
    if (isArray) {
      record[realKey] = [];
    }
    else {
      record[realKey] = {};
    }
  }

  nestItem(record[realKey], key, value, idx + 1);
  return record;
};