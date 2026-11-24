import { describe, expect, it } from "vitest";
import { imageWording } from "./ActivityList";

describe("imageWording", () => {
  it("shows stored credit wording as images", () => {
    expect(imageWording("Welcome trial credits")).toBe("Welcome trial images");
    expect(imageWording("Credit purchase")).toBe("Image purchase");
    expect(imageWording("Standard render")).toBe("Standard render");
  });
});
