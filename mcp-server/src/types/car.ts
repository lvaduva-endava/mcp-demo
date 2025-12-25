// Domain types for car retail MCP
export type EngineType = "petrol" | "diesel" | "hybrid" | "ev";
export type CarStatus = "available" | "sold";

export interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  engine: EngineType;
  trim?: string;
  basePrice: number;
  status: CarStatus;
}
