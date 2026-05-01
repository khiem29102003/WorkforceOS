import { randomBytes, timingSafeEqual } from "node:crypto";
import { Injectable, NestMiddleware, ForbiddenException } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import type { RequestWithAuth } from "../../interfaces/http/request-with-auth";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_COOKIE = "ewos_csrf";
const CSRF_HEADER = "x-csrf-token";

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: RequestWithAuth, res: Response, next: NextFunction): void {
    const token = typeof req.cookies?.[CSRF_COOKIE] === "string" ? req.cookies[CSRF_COOKIE] : randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production"
    });

    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const header = req.header(CSRF_HEADER);
    if (!header || !this.equal(header, token)) {
      throw new ForbiddenException("Invalid CSRF token");
    }
    next();
  }

  private equal(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
