import { Order } from "../types/order.js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ordersFilePath = join(__dirname, "orders.json");

// Load orders from JSON file
function loadOrders(): Order[] {
  const data = readFileSync(ordersFilePath, "utf-8");
  return JSON.parse(data);
}

// Save orders to JSON file
function saveOrders(orders: Order[]): void {
  writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), "utf-8");
}

// In-memory cache
export let orders: Order[] = loadOrders();

export function createOrder(orderData: Omit<Order, "createdAt">): Order {
  const newOrder: Order = {
    ...orderData,
    createdAt: new Date().toISOString(),
  };
  
  orders.push(newOrder);
  saveOrders(orders);
  return newOrder;
}

export function getOrderById(orderId: string): Order | undefined {
  return orders.find(o => o.orderId === orderId);
}

export function getOrdersByCarId(carId: string): Order[] {
  return orders.filter(o => o.carId === carId);
}

export function reloadOrders(): void {
  orders = loadOrders();
}
