import ITechRecord from "./techRecord";

export default interface IVehicle {
    primaryVrm?: string;
    secondaryVrms?: string[];
    vin: string;
    systemNumber: string;
    partialVin?: string;
    trailerId?: string;
    techRecord: ITechRecord[];
}
