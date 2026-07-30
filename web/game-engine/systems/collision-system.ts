export interface CircleBounds {
  type: "circle";
  x: number;
  y: number;
  radius: number;
}

export interface RectangleBounds {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CollisionBounds = CircleBounds | RectangleBounds;

export function intersects(left: CollisionBounds, right: CollisionBounds) {
  if (left.type === "circle" && right.type === "circle") {
    const x = left.x - right.x;
    const y = left.y - right.y;
    const radii = left.radius + right.radius;
    return x * x + y * y <= radii * radii;
  }
  if (left.type === "rectangle" && right.type === "rectangle") {
    return left.x < right.x + right.width
      && left.x + left.width > right.x
      && left.y < right.y + right.height
      && left.y + left.height > right.y;
  }
  const circle = left.type === "circle" ? left : right as CircleBounds;
  const rectangle = left.type === "rectangle" ? left : right as RectangleBounds;
  const closestX = Math.max(rectangle.x, Math.min(circle.x, rectangle.x + rectangle.width));
  const closestY = Math.max(rectangle.y, Math.min(circle.y, rectangle.y + rectangle.height));
  const x = circle.x - closestX;
  const y = circle.y - closestY;
  return x * x + y * y <= circle.radius * circle.radius;
}
