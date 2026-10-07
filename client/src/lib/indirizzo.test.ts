import { test, expect } from "vitest"
import { normalizzaIndirizzo } from "./indirizzo"

test("normalizzaIndirizzo", () => {
  expect(normalizzaIndirizzo("192.168.1.20")).toBe("http://192.168.1.20:8090")
  expect(normalizzaIndirizzo("  pc-server  ")).toBe("http://pc-server:8090")
  expect(normalizzaIndirizzo("pc-server:9000/")).toBe("http://pc-server:9000")
  expect(normalizzaIndirizzo("http://10.0.0.5:8090/_/")).toBe("http://10.0.0.5:8090")
  expect(normalizzaIndirizzo("https://gieffe.lan")).toBe("https://gieffe.lan")
  expect(normalizzaIndirizzo("localhost")).toBe("http://localhost:8090")
  expect(normalizzaIndirizzo("")).toBeNull()
  expect(normalizzaIndirizzo("   ")).toBeNull()
  expect(normalizzaIndirizzo("http://")).toBeNull()
})
