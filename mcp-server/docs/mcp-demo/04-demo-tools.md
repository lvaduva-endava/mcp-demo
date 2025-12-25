# Demo: MCP Tools

## What this demonstrates
- A **Tool** is an action with a schema (inputs) and a result.
- Tools are ideal for *operations* like search, compute, or mutations.

This server exposes tools:
- `list_cars`
- `check_car_configuration`
- `generate_quotation`
- `create_order`
- `list_orders`

## Scenario A — Browse inventory (simple + visual)
Type:
> Show me all available electric cars.

Expected tool usage:
- `check_car_configuration` with `{ "engine": "ev" }`

Expected result:
- A list of matching cars and `count`.

## Scenario B — Quote a known car (deterministic)
Type:
> Give me a quote for car c1 with 10% discount.

Expected tool usage:
- `generate_quotation` with `{ "carId": "c1", "discountPct": 10 }`

Expected result:
- `basePrice`, `discountPct`, `finalPrice`, `currency`.

## Scenario C — Create an order (shows side-effects)
Type:
> Create an order for car c1, customer Maria Ionescu, agreed price 21150.

Expected tool usage:
- `create_order`

Expected result:
- Returns `orderId`, timestamps, and order details.

Verification (server-side):
- `src/data/orders.json` contains the new order.
- `src/data/cars.json` has `c1.status = "sold"`.

## Optional “closing” check
Type:
> List all orders.

Expected tool usage:
- `list_orders`

Expected result:
- `count` increases and includes the new order.
