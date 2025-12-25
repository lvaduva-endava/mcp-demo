// Order domain type
export interface Order {
  orderId: string;
  carId: string;
  customerName: string;
  agreedPrice: number;
  createdAt: string; // ISO 8601 timestamp
  status: "created";
}
