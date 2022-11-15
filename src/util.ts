import logger from './logger';
import _ from 'lodash';

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