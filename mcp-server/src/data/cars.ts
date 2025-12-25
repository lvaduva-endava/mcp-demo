import { Car } from "../types/car.js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const carsFilePath = join(__dirname, "cars.json");

// Load cars from JSON file
function loadCars(): Car[] {
  const data = readFileSync(carsFilePath, "utf-8");
  return JSON.parse(data);
}

// Save cars to JSON file
function saveCars(cars: Car[]): void {
  writeFileSync(carsFilePath, JSON.stringify(cars, null, 2), "utf-8");
}

// In-memory cache (reloaded on each module import)
export let cars: Car[] = loadCars();

export function findCar(carId: string): Car | undefined {
  return cars.find(c => c.id === carId);
}

export function updateCarStatus(carId: string, status: "available" | "sold"): boolean {
  const car = findCar(carId);
  if (!car) return false;
  
  car.status = status;
  saveCars(cars);
  return true;
}

export function reloadCars(): void {
  cars = loadCars();
}
