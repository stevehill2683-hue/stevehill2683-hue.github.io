const ALLOWED_ORIGINS = new Set([
  "https://stevehill2683-hue.github.io",
  "https://steve-anita-security-test.pages.dev",
]);

const SESSION_LENGTH_SECONDS = 8 * 60 * 60;
const IDLE_WARNING_SECONDS = 15 * 60;
const IDLE_LOGOUT_SECONDS = 17 * 60;
const OWNER_SESSION_LENGTH_SECONDS = 60 * 60;
const OWNER_SESSION_WARNING_SECONDS = 5 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    try {
      if (request.method === "OPTIONS") {
        return handleOptions(origin);
      }

      if (request.method === "GET" && url.pathname === "/") {
        return jsonResponse(
          {
            status: "OK",
            service: "Steve & Anita Family Access Test",
            database: env.DB ? "Bound" : "Missing",
            authSecret: env.AUTH_SECRET ? "Loaded" : "Missing",
            endpoints: [
              "/login",
              "/session",
              "/activity",
              "/page",
              "/logout",
              "/owner-password-change",
            ],
          },
          200,
          origin
        );
      }

      if (request.method !== "POST") {
        throw new ApiError(
          405,
          "METHOD_NOT_ALLOWED",
          "Method not allowed."
        );
      }

      requireAllowedOrigin(origin);

      if (!env.DB) {
        throw new ApiError(
          500,
          "DATABASE_MISSING",
          "Database binding is unavailable."
        );
      }

      if (!env.AUTH_SECRET) {
        throw new ApiError(
          500,
          "SECRET_MISSING",
          "Authentication secret is unavailable."
        );
      }

      switch (url.pathname) {
        case "/login":
          return await handleLogin(request, env, origin);

        case "/owner-login":
          return await handleOwnerLogin(
            request,
            env,
            origin
          );

        case "/owner-session":
          return await handleOwnerSession(
            request,
            env,
            origin
          );

        case "/owner-members":
          return await handleOwnerMembers(
            request,
            env,
            origin
          );

        case "/owner-member-create":
          return await handleOwnerMemberCreate(
            request,
            env,
            origin
          );

        case "/owner-member-update":
          return await handleOwnerMemberUpdate(
            request,
            env,
            origin
          );

        case "/owner-member-code":
          return await handleOwnerMemberCode(
            request,
            env,
            origin
          );

        case "/owner-member-status":
          return await handleOwnerMemberStatus(
            request,
            env,
            origin
          );

        case "/owner-member-logging":
          return await handleOwnerMemberLogging(
            request,
            env,
            origin
          );

        case "/owner-password-change":
          return await handleOwnerPasswordChange(
            request,
            env,
            origin
          );

        case "/owner-visits":
          return await handleOwnerVisitSummary(
            request,
            env,
            origin
          );

        case "/owner-visit-detail":
          return await handleOwnerVisitDetail(
            request,
            env,
            origin
          );

        case "/session":
          return await handleSession(
            request,
            env,
            origin
          );

        case "/activity":
          return await handleActivity(
            request,
            env,
            origin
          );

        case "/page":
          return await handlePage(
            request,
            env,
            origin
          );

        case "/logout":
          return await handleLogout(
            request,
            env,
            origin
          );

        default:
          throw new ApiError(
            404,
            "NOT_FOUND",
            "Endpoint not found."
          );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        return jsonResponse(
          {
            status:
              error.statusCode === 401
                ? "DENIED"
                : "ERROR",
            code: error.code,
            message: error.message,
          },
          error.statusCode,
          origin
        );
      }

      console.error("Worker error:", error);

      return jsonResponse(
        {
          status: "ERROR",
          code: "INTERNAL_ERROR",
          message:
            "The request could not be completed.",
        },
        500,
        origin
      );
    }
  },
};

async function handleLogin(
  request,
  env,
  origin
) {
  const body = await readJson(request);
  const code = String(
    body.code || ""
  ).trim();

  if (!/^\d{6}$/.test(code)) {
    await recordFailedAttempt(
      request,
      env,
      body,
      "Invalid code format",
      false
    );

    throw new ApiError(
      401,
      "INVALID_CODE",
      "Access code not recognized."
    );
  }

  const deviceType = cleanText(
    body.deviceType,
    "Unknown",
    40
  );

  const browserFamily = cleanText(
    body.browserFamily,
    "Unknown",
    40
  );

  const clientTimezone = cleanText(
    body.clientTimezone,
    "Unknown",
    80
  );

  const testLogging =
    body.testLogging === true;

  const memberResult =
    await env.DB.prepare(
      `SELECT
         id,
         display_name,
         code_salt,
         code_hash,
         is_active,
         is_owner,
         logging_enabled
       FROM members
       WHERE is_active = 1
       ORDER BY id`
    ).all();

  let matchedMember = null;

  for (
    const member of
      memberResult.results || []
  ) {
    const candidateHash =
      await hmacHex(
        env.AUTH_SECRET,
        `${member.code_salt}:${code}`
      );

    if (
      secureEqualHex(
        candidateHash,
        String(
          member.code_hash || ""
        )
      )
    ) {
      matchedMember = member;
      break;
    }
  }

  if (!matchedMember) {
    await recordFailedAttempt(
      request,
      env,
      body,
      "Invalid code",
      false
    );

    throw new ApiError(
      401,
      "INVALID_CODE",
      "Access code not recognized."
    );
  }

  const isOwner =
    Number(
      matchedMember.is_owner
    ) === 1;

  const loggingEnabled =
    Number(
      matchedMember.logging_enabled
    ) === 1 ||
    (isOwner && testLogging);

  const codeVersion =
    await deriveCredentialVersion(
      env.AUTH_SECRET,
      "family-code",
      String(
        matchedMember.code_hash || ""
      )
    );

  const issuedAt =
    Math.floor(
      Date.now() / 1000
    );

  const expiresAt =
    issuedAt +
    SESSION_LENGTH_SECONDS;

  const now = sqliteUtcNow();

  let visitId = null;
  let sessionToken = null;

  if (loggingEnabled) {
    const pendingTokenHash =
      await sha256Hex(
        `pending:` +
        `${crypto.randomUUID()}:` +
        `${matchedMember.id}:` +
        `${now}`
      );

    const insertResult =
      await env.DB.prepare(
        `INSERT INTO visits (
           member_id,
           session_token_hash,
           started_at,
           last_activity_at,
           ended_at,
           end_reason,
           device_type,
           browser_family,
           client_timezone,
           logging_enabled
         )
         VALUES (
           ?,
           ?,
           ?,
           ?,
           NULL,
           NULL,
           ?,
           ?,
           ?,
           1
         )`
      )
        .bind(
          matchedMember.id,
          pendingTokenHash,
          now,
          now,
          deviceType,
          browserFamily,
          clientTimezone
        )
        .run();

    visitId = Number(
      insertResult.meta.last_row_id
    );

    if (
      !Number.isInteger(visitId) ||
      visitId < 1
    ) {
      throw new ApiError(
        500,
        "VISIT_CREATE_FAILED",
        "The visit could not be created."
      );
    }

    try {
      sessionToken =
        await createSessionToken(
          env.AUTH_SECRET,
          {
            version: 3,

            memberId:
              Number(
                matchedMember.id
              ),

            displayName:
              String(
                matchedMember
                  .display_name
              ),

            isOwner,

            loggingEnabled: true,

            visitId,

            codeVersion,

            issuedAt,

            expiresAt,

            nonce:
              crypto.randomUUID(),
          }
        );

      const sessionTokenHash =
        await sha256Hex(
          sessionToken
        );

      await env.DB.prepare(
        `UPDATE visits
         SET session_token_hash = ?
         WHERE id = ?
           AND member_id = ?`
      )
        .bind(
          sessionTokenHash,
          visitId,
          matchedMember.id
        )
        .run();
    } catch (error) {
      await env.DB.prepare(
        `DELETE FROM visits
         WHERE id = ?`
      )
        .bind(visitId)
        .run();

      throw error;
    }
  } else {
    sessionToken =
      await createSessionToken(
        env.AUTH_SECRET,
        {
          version: 3,

          memberId:
            Number(
              matchedMember.id
            ),

          displayName:
            String(
              matchedMember
                .display_name
            ),

          isOwner,

          loggingEnabled: false,

          visitId: null,

          codeVersion,

          issuedAt,

          expiresAt,

          nonce:
            crypto.randomUUID(),
        }
      );
  }

  return jsonResponse(
    {
      status: "OK",

      message:
        "Access granted.",

      displayName:
        String(
          matchedMember.display_name
        ),

      isOwner,

      loggingEnabled,

      visitId,

      sessionToken,

      expiresAt,

      idleWarningSeconds:
        IDLE_WARNING_SECONDS,

      idleLogoutSeconds:
        IDLE_LOGOUT_SECONDS,
    },
    200,
    origin
  );
}

async function handleSession(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const session =
    await authenticateSession(
      request,
      body,
      env
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Session is active.",

      displayName:
        session.displayName,

      isOwner:
        session.isOwner,

      loggingEnabled:
        session.loggingEnabled,

      visitId:
        session.visitId,

      expiresAt:
        session.expiresAt,

      idleWarningSeconds:
        IDLE_WARNING_SECONDS,

      idleLogoutSeconds:
        IDLE_LOGOUT_SECONDS,

      lastActivityAt:
        session.lastActivityAt,
    },
    200,
    origin
  );
}

async function handleActivity(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const session =
    await authenticateSession(
      request,
      body,
      env
    );

  const now =
    sqliteUtcNow();

  if (
    session.loggingEnabled
  ) {
    await env.DB.prepare(
      `UPDATE visits
       SET last_activity_at = ?
       WHERE id = ?
         AND member_id = ?
         AND session_token_hash = ?
         AND ended_at IS NULL`
    )
      .bind(
        now,
        session.visitId,
        session.memberId,
        session.sessionTokenHash
      )
      .run();
  }

  return jsonResponse(
    {
      status: "OK",

      message:
        "Activity recorded.",

      loggingEnabled:
        session.loggingEnabled,

      visitId:
        session.visitId,

      activityAt:
        now,
    },
    200,
    origin
  );
}

async function handlePage(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const session =
    await authenticateSession(
      request,
      body,
      env
    );

  const action =
    String(
      body.action || "enter"
    ).toLowerCase();

  const pageName =
    cleanText(
      body.pageName,
      "Untitled page",
      120
    );

  const pagePath =
    cleanPagePath(
      body.pagePath
    );

  const now =
    sqliteUtcNow();

  if (
    !session.loggingEnabled
  ) {
    return jsonResponse(
      {
        status: "OK",

        message:
          "Page accepted without logging.",

        tracked: false,

        visitId: null,
      },
      200,
      origin
    );
  }

  if (action === "leave") {
    await closeOpenPage(
      env,
      session.visitId,
      now,
      pagePath
    );

    await updateVisitActivity(
      env,
      session,
      now
    );

    return jsonResponse(
      {
        status: "OK",

        message:
          "Page visit closed.",

        tracked: true,

        visitId:
          session.visitId,

        pagePath,
      },
      200,
      origin
    );
  }

  if (action !== "enter") {
    throw new ApiError(
      400,
      "INVALID_PAGE_ACTION",
      "Page action must be enter or leave."
    );
  }

  const currentPage =
    await env.DB.prepare(
      `SELECT
         id,
         page_path
       FROM page_history
       WHERE visit_id = ?
         AND left_at IS NULL
       ORDER BY
         sequence_number DESC
       LIMIT 1`
    )
      .bind(
        session.visitId
      )
      .first();

  if (
    currentPage &&
    String(
      currentPage.page_path
    ) === pagePath
  ) {
    await updateVisitActivity(
      env,
      session,
      now
    );

    return jsonResponse(
      {
        status: "OK",

        message:
          "Page is already active.",

        tracked: true,

        visitId:
          session.visitId,

        pageEntryId:
          Number(
            currentPage.id
          ),

        pagePath,
      },
      200,
      origin
    );
  }

  await closeOpenPage(
    env,
    session.visitId,
    now
  );

  const sequenceRow =
    await env.DB.prepare(
      `SELECT
         COALESCE(
           MAX(sequence_number),
           0
         ) + 1 AS next_sequence
       FROM page_history
       WHERE visit_id = ?`
    )
      .bind(
        session.visitId
      )
      .first();

  const sequenceNumber =
    Number(
      sequenceRow
        ?.next_sequence || 1
    );

  const insertResult =
    await env.DB.prepare(
      `INSERT INTO page_history (
         visit_id,
         page_name,
         page_path,
         entered_at,
         left_at,
         duration_seconds,
         sequence_number
       )
       VALUES (
         ?,
         ?,
         ?,
         ?,
         NULL,
         NULL,
         ?
       )`
    )
      .bind(
        session.visitId,
        pageName,
        pagePath,
        now,
        sequenceNumber
      )
      .run();

  await updateVisitActivity(
    env,
    session,
    now
  );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Page visit recorded.",

      tracked: true,

      visitId:
        session.visitId,

      pageEntryId:
        Number(
          insertResult
            .meta
            .last_row_id
        ),

      sequenceNumber,

      pageName,

      pagePath,

      enteredAt:
        now,
    },
    200,
    origin
  );
}

async function handleLogout(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const session =
    await authenticateSession(
      request,
      body,
      env,
      {
        allowIdleExpired:
          true,
      }
    );

  const reason =
    normalizeLogoutReason(
      body.reason
    );

  const now =
    sqliteUtcNow();

  if (
    session.loggingEnabled
  ) {
    await closeVisit(
      env,
      session.visitId,
      session.memberId,
      session.sessionTokenHash,
      reason,
      now
    );
  }

  return jsonResponse(
    {
      status: "OK",

      message:
        "Logged out.",

      loggingEnabled:
        session.loggingEnabled,

      visitId:
        session.visitId,

      endedAt:
        now,

      endReason:
        reason,
    },
    200,
    origin
  );
}

async function authenticateSession(
  request,
  body,
  env,
  options = {
    allowIdleExpired: false,
  }
) {
  const sessionToken =
    getSessionToken(
      request,
      body
    );

  if (!sessionToken) {
    throw new ApiError(
      401,
      "SESSION_REQUIRED",
      "A session token is required."
    );
  }

  const verified =
    await verifySessionToken(
      sessionToken,
      env.AUTH_SECRET
    );

  const payload =
    verified.payload;

  const member =
    await env.DB.prepare(
      `SELECT
         id,
         display_name,
         code_hash,
         is_active,
         is_owner
       FROM members
       WHERE id = ?
       LIMIT 1`
    )
      .bind(
        payload.memberId
      )
      .first();

  if (
    !member ||
    Number(
      member.is_active
    ) !== 1
  ) {
    throw new ApiError(
      401,
      "MEMBER_INACTIVE",
      "This family access account is inactive."
    );
  }

  const session = {
    memberId:
      Number(member.id),

    displayName:
      String(
        member.display_name
      ),

    isOwner:
      Number(
        member.is_owner
      ) === 1,

    loggingEnabled:
      payload.loggingEnabled ===
      true,

    visitId:
      payload.visitId === null
        ? null
        : Number(
            payload.visitId
          ),

    issuedAt:
      Number(
        payload.issuedAt
      ),

    expiresAt:
      Number(
        payload.expiresAt
      ),

    sessionToken,

    sessionTokenHash:
      await sha256Hex(
        sessionToken
      ),

    lastActivityAt:
      null,
  };

  const currentCodeVersion =
    await deriveCredentialVersion(
      env.AUTH_SECRET,
      "family-code",
      String(
        member.code_hash || ""
      )
    );

  if (
    !secureEqualHex(
      String(
        payload.codeVersion || ""
      ),
      currentCodeVersion
    )
  ) {
    if (
      session.loggingEnabled &&
      session.visitId
    ) {
      await closeVisit(
        env,
        session.visitId,
        session.memberId,
        session.sessionTokenHash,
        "code_changed",
        sqliteUtcNow()
      );
    }

    throw new ApiError(
      401,
      "SESSION_REVOKED",
      "The session ended because the access code changed."
    );
  }

  if (verified.expired) {
    if (
      session.loggingEnabled &&
      session.visitId
    ) {
      await closeVisit(
        env,
        session.visitId,
        session.memberId,
        session.sessionTokenHash,
        "session_expired",
        sqliteUtcNow()
      );
    }

    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "The session has expired."
    );
  }

  if (
    !session.loggingEnabled
  ) {
    return session;
  }

  if (
    !Number.isInteger(
      session.visitId
    ) ||
    session.visitId < 1
  ) {
    throw new ApiError(
      401,
      "SESSION_INVALID",
      "The session is invalid."
    );
  }

  const visit =
    await env.DB.prepare(
      `SELECT
         id,
         member_id,
         last_activity_at,
         ended_at,
         logging_enabled
       FROM visits
       WHERE id = ?
         AND member_id = ?
         AND session_token_hash = ?
       LIMIT 1`
    )
      .bind(
        session.visitId,
        session.memberId,
        session.sessionTokenHash
      )
      .first();

  if (!visit) {
    throw new ApiError(
      401,
      "SESSION_INVALID",
      "The session is invalid."
    );
  }

  if (visit.ended_at) {
    throw new ApiError(
      401,
      "SESSION_ENDED",
      "The session has already ended."
    );
  }

  session.lastActivityAt =
    visit.last_activity_at ||
    null;

  const idleSeconds =
    secondsSinceSqliteUtc(
      visit.last_activity_at
    );

  if (
    idleSeconds >=
      IDLE_LOGOUT_SECONDS &&
    !options.allowIdleExpired
  ) {
    await closeVisit(
      env,
      session.visitId,
      session.memberId,
      session.sessionTokenHash,
      "idle_timeout",
      sqliteUtcNow()
    );

    throw new ApiError(
      401,
      "IDLE_TIMEOUT",
      "The session ended because it was inactive."
    );
  }

  return session;
}

async function closeVisit(
  env,
  visitId,
  memberId,
  sessionTokenHash,
  reason,
  now
) {
  await closeOpenPage(
    env,
    visitId,
    now
  );

  await env.DB.prepare(
    `UPDATE visits
     SET ended_at = ?,
         end_reason = ?,
         last_activity_at = ?
     WHERE id = ?
       AND member_id = ?
       AND session_token_hash = ?
       AND ended_at IS NULL`
  )
    .bind(
      now,
      reason,
      now,
      visitId,
      memberId,
      sessionTokenHash
    )
    .run();
}

async function closeOpenPage(
  env,
  visitId,
  now,
  requiredPagePath = null
) {
  let sql =
    `UPDATE page_history
     SET left_at = ?,
         duration_seconds = MAX(
           0,
           CAST(
             (
               julianday(?) -
               julianday(
                 entered_at
               )
             ) * 86400
             AS INTEGER
           )
         )
     WHERE visit_id = ?
       AND left_at IS NULL`;

  const bindings = [
    now,
    now,
    visitId,
  ];

  if (requiredPagePath) {
    sql +=
      " AND page_path = ?";

    bindings.push(
      requiredPagePath
    );
  }

  await env.DB.prepare(sql)
    .bind(...bindings)
    .run();
}

async function updateVisitActivity(
  env,
  session,
  now
) {
  await env.DB.prepare(
    `UPDATE visits
     SET last_activity_at = ?
     WHERE id = ?
       AND member_id = ?
       AND session_token_hash = ?
       AND ended_at IS NULL`
  )
    .bind(
      now,
      session.visitId,
      session.memberId,
      session.sessionTokenHash
    )
    .run();
}

async function recordFailedAttempt(
  request,
  env,
  body,
  failureReason,
  wasRateLimited
) {
  try {
    const deviceType =
      cleanText(
        body.deviceType,
        "Unknown",
        40
      );

    const browserFamily =
      cleanText(
        body.browserFamily,
        "Unknown",
        40
      );

    const clientTimezone =
      cleanText(
        body.clientTimezone,
        "Unknown",
        80
      );

    const ipAddress =
      request.headers.get(
        "CF-Connecting-IP"
      ) || "Unknown";

    const userAgent =
      request.headers.get(
        "User-Agent"
      ) || "Unknown";

    const fingerprintHash =
      await hmacHex(
        env.AUTH_SECRET,
        `failed-attempt:` +
        `${ipAddress}:` +
        `${userAgent}`
      );

    await env.DB.prepare(
      `INSERT INTO failed_attempts (
         attempted_at,
         device_type,
         browser_family,
         client_timezone,
         security_fingerprint_hash,
         failure_reason,
         was_rate_limited
       )
       VALUES (
         ?,
         ?,
         ?,
         ?,
         ?,
         ?,
         ?
       )`
    )
      .bind(
        sqliteUtcNow(),
        deviceType,
        browserFamily,
        clientTimezone,
        fingerprintHash,
        failureReason,
        wasRateLimited
          ? 1
          : 0
      )
      .run();
  } catch (error) {
    console.error(
      "Failed-attempt logging error:",
      error
    );
  }
}

async function createSessionToken(
  secret,
  payload
) {
  const payloadSegment =
    bytesToBase64Url(
      encoder.encode(
        JSON.stringify(
          payload
        )
      )
    );

  const signature =
    await hmacBytes(
      secret,
      payloadSegment
    );

  const signatureSegment =
    bytesToBase64Url(
      signature
    );

  return (
    `${payloadSegment}.` +
    `${signatureSegment}`
  );
}

async function verifySessionToken(
  token,
  secret
) {
  const parts =
    String(token).split(".");

  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1]
  ) {
    throw new ApiError(
      401,
      "SESSION_INVALID",
      "The session is invalid."
    );
  }

  let signatureBytes;
  let payload;

  try {
    signatureBytes =
      base64UrlToBytes(
        parts[1]
      );

    payload =
      JSON.parse(
        decoder.decode(
          base64UrlToBytes(
            parts[0]
          )
        )
      );
  } catch {
    throw new ApiError(
      401,
      "SESSION_INVALID",
      "The session is invalid."
    );
  }

  const key =
    await importHmacKey(
      secret,
      ["verify"]
    );

  const valid =
    await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(
        parts[0]
      )
    );

  if (!valid) {
    throw new ApiError(
      401,
      "SESSION_INVALID",
      "The session is invalid."
    );
  }

  if (
    payload.version !== 3 ||
    !Number.isInteger(
      Number(
        payload.memberId
      )
    ) ||
    !Number.isFinite(
      Number(
        payload.issuedAt
      )
    ) ||
    !Number.isFinite(
      Number(
        payload.expiresAt
      )
    ) ||
    typeof
      payload.loggingEnabled !==
      "boolean" ||
    typeof
      payload.codeVersion !==
      "string" ||
    !/^[0-9a-f]{64}$/i.test(
      payload.codeVersion
    )
  ) {
    throw new ApiError(
      401,
      "SESSION_INVALID",
      "The session is invalid."
    );
  }

  return {
    payload,

    expired:
      Math.floor(
        Date.now() / 1000
      ) >=
      Number(
        payload.expiresAt
      ),
  };
}

async function hmacHex(
  secret,
  message
) {
  return bytesToHex(
    await hmacBytes(
      secret,
      message
    )
  );
}

async function hmacBytes(
  secret,
  message
) {
  const key =
    await importHmacKey(
      secret,
      ["sign"]
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(
        message
      )
    );

  return new Uint8Array(
    signature
  );
}

async function importHmacKey(
  secret,
  usages
) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(
      secret
    ),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    usages
  );
}

async function sha256Hex(
  value
) {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(
        value
      )
    );

  return bytesToHex(
    new Uint8Array(
      digest
    )
  );
}

function secureEqualHex(
  leftHex,
  rightHex
) {
  try {
    const left =
      hexToBytes(
        leftHex
      );

    const right =
      hexToBytes(
        rightHex
      );

    if (
      left.length !==
        right.length ||
      left.length === 0
    ) {
      return false;
    }

    if (
      typeof
        crypto.subtle
          .timingSafeEqual ===
        "function"
    ) {
      return crypto.subtle
        .timingSafeEqual(
          left,
          right
        );
    }

    let difference = 0;

    for (
      let index = 0;
      index <
        left.length;
      index += 1
    ) {
      difference |=
        left[index] ^
        right[index];
    }

    return difference === 0;
  } catch {
    return false;
  }
}

function getSessionToken(
  request,
  body
) {
  const authorization =
    request.headers.get(
      "Authorization"
    ) || "";

  if (
    authorization.startsWith(
      "Bearer "
    )
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  return typeof
    body.sessionToken ===
    "string"
    ? body.sessionToken.trim()
    : "";
}

async function readJson(
  request
) {
  const contentType =
    request.headers.get(
      "Content-Type"
    ) || "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json"
      )
  ) {
    throw new ApiError(
      415,
      "JSON_REQUIRED",
      "Content-Type must be application/json."
    );
  }

  try {
    const body =
      await request.json();

    if (
      !body ||
      typeof body !==
        "object" ||
      Array.isArray(body)
    ) {
      throw new Error(
        "Invalid JSON object"
      );
    }

    return body;
  } catch {
    throw new ApiError(
      400,
      "INVALID_JSON",
      "The request body must contain valid JSON."
    );
  }
}

function normalizeLogoutReason(
  value
) {
  const allowedReasons =
    new Set([
      "manual_logout",
      "idle_timeout",
      "browser_closed",
      "session_expired",
    ]);

  const reason =
    String(
      value ||
        "manual_logout"
    ).toLowerCase();

  return allowedReasons.has(
    reason
  )
    ? reason
    : "manual_logout";
}

function cleanText(
  value,
  fallback,
  maximumLength
) {
  const cleaned =
    String(value || "")
      .replace(
        /[\u0000-\u001F\u007F]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return (
    cleaned || fallback
  ).slice(
    0,
    maximumLength
  );
}

function cleanPagePath(
  value
) {
  const path =
    cleanText(
      value,
      "/",
      500
    );

  return path.startsWith("/")
    ? path
    : `/${path}`;
}

function sqliteUtcNow() {
  return new Date()
    .toISOString()
    .replace(
      "T",
      " "
    )
    .replace(
      /\.\d{3}Z$/,
      ""
    );
}

function secondsSinceSqliteUtc(
  value
) {
  if (!value) {
    return 0;
  }

  const timestamp =
    Date.parse(
      String(value)
        .replace(
          " ",
          "T"
        ) + "Z"
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (
        Date.now() -
        timestamp
      ) / 1000
    )
  );
}

function bytesToHex(
  bytes
) {
  return Array.from(
    bytes,
    (byte) =>
      byte
        .toString(16)
        .padStart(
          2,
          "0"
        )
  ).join("");
}

function hexToBytes(
  hex
) {
  const normalized =
    String(hex)
      .trim()
      .toLowerCase();

  if (
    !/^[0-9a-f]+$/.test(
      normalized
    ) ||
    normalized.length %
      2 !==
      0
  ) {
    throw new Error(
      "Invalid hexadecimal value"
    );
  }

  const bytes =
    new Uint8Array(
      normalized.length / 2
    );

  for (
    let index = 0;
    index <
      normalized.length;
    index += 2
  ) {
    bytes[index / 2] =
      Number.parseInt(
        normalized.slice(
          index,
          index + 2
        ),
        16
      );
  }

  return bytes;
}

function bytesToBase64Url(
  bytes
) {
  let binary = "";

  for (
    const byte of bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      );
  }

  return btoa(binary)
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/g,
      ""
    );
}

function base64UrlToBytes(
  value
) {
  const normalized =
    String(value)
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );

  const padded =
    normalized +
    "=".repeat(
      (
        4 -
        normalized.length %
          4
      ) % 4
    );

  const binary =
    atob(padded);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let index = 0;
    index <
      binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index
      );
  }

  return bytes;
}

function handleOptions(
  origin
) {
  requireAllowedOrigin(
    origin
  );

  return new Response(
    null,
    {
      status: 204,

      headers:
        responseHeaders(
          origin
        ),
    }
  );
}

function requireAllowedOrigin(
  origin
) {
  if (
    !origin ||
    !ALLOWED_ORIGINS.has(
      origin
    )
  ) {
    throw new ApiError(
      403,
      "ORIGIN_DENIED",
      "Origin not allowed."
    );
  }
}

function responseHeaders(
  origin
) {
  const headers =
    new Headers({
      "Access-Control-Allow-Methods":
        "GET, POST, OPTIONS",

      "Access-Control-Allow-Headers":
        "Content-Type, Authorization",

      "Access-Control-Max-Age":
        "86400",

      "Cache-Control":
        "no-store",

      "Content-Security-Policy":
        "default-src 'none'; " +
        "frame-ancestors 'none'",

      "Referrer-Policy":
        "no-referrer",

      "X-Content-Type-Options":
        "nosniff",

      "X-Robots-Tag":
        "noindex",

      "Vary":
        "Origin",
    });

  if (
    origin &&
    ALLOWED_ORIGINS.has(
      origin
    )
  ) {
    headers.set(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  return headers;
}

function jsonResponse(
  data,
  status,
  origin
) {
  const headers =
    responseHeaders(
      origin
    );

  headers.set(
    "Content-Type",
    "application/json; charset=UTF-8"
  );

  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,
      headers,
    }
  );
}

class ApiError extends Error {
  constructor(
    statusCode,
    code,
    message
  ) {
    super(message);

    this.name =
      "ApiError";

    this.statusCode =
      statusCode;

    this.code =
      code;
  }
}

async function handleOwnerLogin(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const password =
    typeof body.password ===
      "string"
      ? body.password
      : "";

  if (
    !password ||
    password.length > 256
  ) {
    throw new ApiError(
      401,
      "OWNER_ACCESS_DENIED",
      "Owner access denied."
    );
  }

  const ipAddress =
    request.headers.get(
      "CF-Connecting-IP"
    ) || "Unknown";

  const userAgent =
    request.headers.get(
      "User-Agent"
    ) || "Unknown";

  const fingerprintHash =
    await hmacHex(
      env.AUTH_SECRET,
      `failed-attempt:` +
      `${ipAddress}:` +
      `${userAgent}`
    );

  const recentFailureRow =
    await env.DB.prepare(
      `SELECT
         COUNT(*) AS failure_count
       FROM failed_attempts
       WHERE security_fingerprint_hash = ?
         AND failure_reason =
           'Invalid owner password'
         AND attempted_at >=
           datetime(
             'now',
             '-15 minutes'
           )`
    )
      .bind(
        fingerprintHash
      )
      .first();

  const recentFailureCount =
    Number(
      recentFailureRow
        ?.failure_count || 0
    );

  if (
    recentFailureCount >= 5
  ) {
    await recordFailedAttempt(
      request,
      env,
      body,
      "Owner login rate limited",
      true
    );

    throw new ApiError(
      429,
      "OWNER_RATE_LIMITED",
      "Too many owner login attempts. Try again later."
    );
  }

  const owner =
    await getActiveOwnerCredential(
      env
    );

  const candidateHash =
    await hmacHex(
      env.AUTH_SECRET,
      `${owner.password_salt}:` +
      `${password}`
    );

  if (
    !secureEqualHex(
      candidateHash,
      String(
        owner.password_hash ||
        ""
      )
    )
  ) {
    await recordFailedAttempt(
      request,
      env,
      body,
      "Invalid owner password",
      false
    );

    throw new ApiError(
      401,
      "OWNER_ACCESS_DENIED",
      "Owner access denied."
    );
  }

  const session =
    await issueOwnerSession(
      env,
      owner
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Owner access granted.",

      displayName:
        String(
          owner.display_name
        ),

      ownerSessionToken:
        session
          .ownerSessionToken,

      expiresAt:
        session.expiresAt,

      warningSeconds:
        OWNER_SESSION_WARNING_SECONDS,
    },
    200,
    origin
  );
}

async function handleOwnerSession(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const ownerSession =
    await authenticateOwnerSession(
      request,
      body,
      env
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Owner session is active.",

      displayName:
        ownerSession
          .displayName,

      expiresAt:
        ownerSession
          .expiresAt,

      warningSeconds:
        OWNER_SESSION_WARNING_SECONDS,
    },
    200,
    origin
  );
}

async function authenticateOwnerSession(
  request,
  body,
  env
) {
  const sessionToken =
    getSessionToken(
      request,
      body
    );

  if (!sessionToken) {
    throw new ApiError(
      401,
      "OWNER_SESSION_REQUIRED",
      "An owner session token is required."
    );
  }

  const parts =
    String(
      sessionToken
    ).split(".");

  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1]
  ) {
    throw new ApiError(
      401,
      "OWNER_SESSION_INVALID",
      "The owner session is invalid."
    );
  }

  let signatureBytes;
  let payload;

  try {
    signatureBytes =
      base64UrlToBytes(
        parts[1]
      );

    payload =
      JSON.parse(
        decoder.decode(
          base64UrlToBytes(
            parts[0]
          )
        )
      );
  } catch {
    throw new ApiError(
      401,
      "OWNER_SESSION_INVALID",
      "The owner session is invalid."
    );
  }

  const key =
    await importHmacKey(
      env.AUTH_SECRET,
      ["verify"]
    );

  const valid =
    await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(
        parts[0]
      )
    );

  if (!valid) {
    throw new ApiError(
      401,
      "OWNER_SESSION_INVALID",
      "The owner session is invalid."
    );
  }

  if (
    payload.version !== 4 ||
    payload.ownerAccess !==
      true ||
    payload.isOwner !==
      true ||
    !Number.isInteger(
      Number(
        payload.memberId
      )
    ) ||
    !Number.isFinite(
      Number(
        payload.issuedAt
      )
    ) ||
    !Number.isFinite(
      Number(
        payload.expiresAt
      )
    ) ||
    typeof
      payload
        .credentialVersion !==
      "string" ||
    !/^[0-9a-f]{64}$/i.test(
      payload
        .credentialVersion
    )
  ) {
    throw new ApiError(
      401,
      "OWNER_SESSION_INVALID",
      "The owner session is invalid."
    );
  }

  if (
    Math.floor(
      Date.now() / 1000
    ) >=
    Number(
      payload.expiresAt
    )
  ) {
    throw new ApiError(
      401,
      "OWNER_SESSION_EXPIRED",
      "The owner session has expired."
    );
  }

  const owner =
    await getActiveOwnerCredential(
      env,
      Number(
        payload.memberId
      )
    );

  const currentCredentialVersion =
    await deriveCredentialVersion(
      env.AUTH_SECRET,
      "owner-password",
      String(
        owner.password_hash ||
        ""
      )
    );

  if (
    !secureEqualHex(
      payload
        .credentialVersion,
      currentCredentialVersion
    )
  ) {
    throw new ApiError(
      401,
      "OWNER_SESSION_REVOKED",
      "The owner session ended because the password changed."
    );
  }

  return {
    memberId:
      Number(
        owner.member_id
      ),

    displayName:
      String(
        owner.display_name
      ),

    expiresAt:
      Number(
        payload.expiresAt
      ),

    sessionToken,
  };
}

async function handleOwnerPasswordChange(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const ownerSession =
    await authenticateOwnerSession(
      request,
      body,
      env
    );

  const currentPassword =
    typeof
      body.currentPassword ===
      "string"
      ? body.currentPassword
      : "";

  const newPassword =
    typeof
      body.newPassword ===
      "string"
      ? body.newPassword
      : "";

  const confirmPassword =
    typeof
      body.confirmPassword ===
      "string"
      ? body.confirmPassword
      : "";

  if (
    !currentPassword ||
    currentPassword.length >
      256
  ) {
    throw new ApiError(
      401,
      "OWNER_CURRENT_PASSWORD_INVALID",
      "The current owner password was not accepted."
    );
  }

  if (
    newPassword.length < 14 ||
    newPassword.length > 128
  ) {
    throw new ApiError(
      400,
      "OWNER_NEW_PASSWORD_INVALID",
      "The new owner password must contain 14 to 128 characters."
    );
  }

  if (
    newPassword !==
    confirmPassword
  ) {
    throw new ApiError(
      400,
      "OWNER_PASSWORD_CONFIRMATION_MISMATCH",
      "The new password confirmation does not match."
    );
  }

  if (
    newPassword ===
    currentPassword
  ) {
    throw new ApiError(
      400,
      "OWNER_PASSWORD_UNCHANGED",
      "Choose a new owner password that is different from the current password."
    );
  }

  const owner =
    await getActiveOwnerCredential(
      env,
      ownerSession.memberId
    );

  const currentCandidateHash =
    await hmacHex(
      env.AUTH_SECRET,
      `${owner.password_salt}:` +
      `${currentPassword}`
    );

  if (
    !secureEqualHex(
      currentCandidateHash,
      String(
        owner.password_hash ||
        ""
      )
    )
  ) {
    await recordFailedAttempt(
      request,
      env,
      body,
      "Invalid owner password change",
      false
    );

    throw new ApiError(
      401,
      "OWNER_CURRENT_PASSWORD_INVALID",
      "The current owner password was not accepted."
    );
  }

  const passwordSalt =
    randomHex(16);

  const passwordHash =
    await hmacHex(
      env.AUTH_SECRET,
      `${passwordSalt}:` +
      `${newPassword}`
    );

  await env.DB.prepare(
    `UPDATE owner_credentials
     SET password_salt = ?,
         password_hash = ?
     WHERE member_id = ?
       AND is_active = 1`
  )
    .bind(
      passwordSalt,
      passwordHash,
      ownerSession.memberId
    )
    .run();

  const updatedOwner = {
    ...owner,

    password_salt:
      passwordSalt,

    password_hash:
      passwordHash,
  };

  const session =
    await issueOwnerSession(
      env,
      updatedOwner
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Owner password changed. Earlier owner sessions were revoked.",

      displayName:
        String(
          owner.display_name
        ),

      ownerSessionToken:
        session
          .ownerSessionToken,

      expiresAt:
        session.expiresAt,

      warningSeconds:
        OWNER_SESSION_WARNING_SECONDS,
    },
    200,
    origin
  );
}

async function getActiveOwnerCredential(
  env,
  requiredMemberId = null
) {
  let sql =
    `SELECT
       oc.id AS credential_id,
       oc.member_id,
       oc.password_salt,
       oc.password_hash,
       m.display_name
     FROM owner_credentials AS oc
     JOIN members AS m
       ON m.id = oc.member_id
     WHERE oc.is_active = 1
       AND m.is_active = 1
       AND m.is_owner = 1`;

  const bindings = [];

  if (
    requiredMemberId !== null
  ) {
    sql +=
      " AND oc.member_id = ?";

    bindings.push(
      requiredMemberId
    );
  }

  sql +=
    " ORDER BY oc.id LIMIT 1";

  const statement =
    env.DB.prepare(sql);

  const owner =
    bindings.length
      ? await statement
          .bind(
            ...bindings
          )
          .first()
      : await statement
          .first();

  if (!owner) {
    throw new ApiError(
      503,
      "OWNER_CREDENTIALS_UNAVAILABLE",
      "Owner credentials are unavailable."
    );
  }

  return owner;
}

async function issueOwnerSession(
  env,
  owner
) {
  const issuedAt =
    Math.floor(
      Date.now() / 1000
    );

  const expiresAt =
    issuedAt +
    OWNER_SESSION_LENGTH_SECONDS;

  const credentialVersion =
    await deriveCredentialVersion(
      env.AUTH_SECRET,
      "owner-password",
      String(
        owner.password_hash ||
        ""
      )
    );

  const ownerSessionToken =
    await createSessionToken(
      env.AUTH_SECRET,
      {
        version: 4,

        memberId:
          Number(
            owner.member_id
          ),

        displayName:
          String(
            owner.display_name
          ),

        isOwner: true,

        ownerAccess: true,

        loggingEnabled:
          false,

        visitId: null,

        credentialVersion,

        issuedAt,

        expiresAt,

        nonce:
          crypto.randomUUID(),
      }
    );

  return {
    ownerSessionToken,
    expiresAt,
  };
}

async function deriveCredentialVersion(
  secret,
  label,
  storedHash
) {
  return hmacHex(
    secret,
    `credential-version:` +
    `${label}:` +
    `${storedHash}`
  );
}

async function handleOwnerVisitSummary(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const ownerSession =
    await authenticateOwnerSession(
      request,
      body,
      env
    );

  const requestedLimit =
    Number(
      body.limit
    );

  const limit =
    Number.isInteger(
      requestedLimit
    ) &&
    requestedLimit >= 1 &&
    requestedLimit <= 100
      ? requestedLimit
      : 50;

  const totalRow =
    await env.DB.prepare(
      `SELECT
         COUNT(*) AS total_visits
       FROM visits
       WHERE logging_enabled = 1`
    ).first();

  const visitResult =
    await env.DB.prepare(
      `SELECT
         v.id AS visit_id,
         v.member_id,
         m.display_name,
         v.started_at,
         v.last_activity_at,
         v.ended_at,
         v.end_reason,
         v.device_type,
         v.browser_family,
         v.client_timezone,
         (
           SELECT COUNT(*)
           FROM page_history AS ph
           WHERE ph.visit_id = v.id
         ) AS page_count,
         (
           SELECT COALESCE(
             SUM(
               COALESCE(
                 ph.duration_seconds,
                 0
               )
             ),
             0
           )
           FROM page_history AS ph
           WHERE ph.visit_id = v.id
         ) AS recorded_seconds
       FROM visits AS v
       JOIN members AS m
         ON m.id = v.member_id
       WHERE v.logging_enabled = 1
       ORDER BY
         v.started_at DESC,
         v.id DESC
       LIMIT ?`
    )
      .bind(limit)
      .all();

  const visits =
    (
      visitResult.results ||
      []
    ).map(
      (row) => ({
        visitId:
          Number(
            row.visit_id
          ),

        memberId:
          Number(
            row.member_id
          ),

        displayName:
          String(
            row.display_name
          ),

        startedAt:
          row.started_at ||
          null,

        lastActivityAt:
          row.last_activity_at ||
          null,

        endedAt:
          row.ended_at ||
          null,

        endReason:
          row.end_reason ||
          null,

        deviceType:
          row.device_type ||
          "Unknown",

        browserFamily:
          row.browser_family ||
          "Unknown",

        clientTimezone:
          row.client_timezone ||
          "Unknown",

        pageCount:
          Number(
            row.page_count ||
            0
          ),

        recordedSeconds:
          Number(
            row.recorded_seconds ||
            0
          ),

        status:
          row.ended_at
            ? "ended"
            : "active",
      })
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Owner visit summary retrieved.",

      requestedBy:
        ownerSession
          .displayName,

      generatedAt:
        sqliteUtcNow(),

      totalVisits:
        Number(
          totalRow
            ?.total_visits ||
          0
        ),

      returnedVisits:
        visits.length,

      visits,
    },
    200,
    origin
  );
}

async function handleOwnerMembers(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const ownerSession =
    await authenticateOwnerSession(
      request,
      body,
      env
    );

  const memberResult =
    await env.DB.prepare(
      `SELECT
         id,
         display_name,
         is_active,
         is_owner,
         logging_enabled,
         created_at,
         updated_at
       FROM members
       ORDER BY
         is_owner DESC,
         LOWER(display_name),
         id`
    ).all();

  const memberRows =
    Array.isArray(
      memberResult.results
    )
      ? memberResult.results
      : [];

  const members =
    memberRows.map(
      (row) => ({
        memberId:
          Number(row.id),

        displayName:
          row.display_name,

        isActive:
          Number(
            row.is_active
          ) === 1,

        isOwner:
          Number(
            row.is_owner
          ) === 1,

        loggingEnabled:
          Number(
            row.logging_enabled
          ) === 1,

        createdAt:
          row.created_at ||
          null,

        updatedAt:
          row.updated_at ||
          null,
      })
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Owner member list retrieved.",

      requestedBy:
        ownerSession
          .displayName,

      generatedAt:
        sqliteUtcNow(),

      totalMembers:
        members.length,

      members,
    },
    200,
    origin
  );
}

// ==========================================
// BLOCK B — OWNER MEMBER MANAGEMENT
// ==========================================

async function handleOwnerMemberCreate(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const ownerSession =
    await authenticateOwnerSession(
      request,
      body,
      env
    );

  const displayName =
    requireMemberDisplayName(
      body.displayName
    );

  const code =
    requireSixDigitCode(
      body.code
    );

  const loggingEnabled =
    body.loggingEnabled ===
      undefined
      ? true
      : requireBooleanValue(
          body.loggingEnabled,
          "loggingEnabled"
        );

  await ensureMemberCodeAvailable(
    env,
    code
  );

  const now =
    sqliteUtcNow();

  const codeSalt =
    randomHex(16);

  const codeHash =
    await hmacHex(
      env.AUTH_SECRET,
      `${codeSalt}:${code}`
    );

  const insertResult =
    await env.DB.prepare(
      `INSERT INTO members (
         display_name,
         code_salt,
         code_hash,
         is_active,
         is_owner,
         logging_enabled,
         created_at,
         updated_at
       )
       VALUES (
         ?,
         ?,
         ?,
         1,
         0,
         ?,
         ?,
         ?
       )`
    )
      .bind(
        displayName,
        codeSalt,
        codeHash,
        loggingEnabled
          ? 1
          : 0,
        now,
        now
      )
      .run();

  const memberId =
    Number(
      insertResult
        .meta
        .last_row_id
    );

  if (
    !Number.isInteger(
      memberId
    ) ||
    memberId < 1
  ) {
    throw new ApiError(
      500,
      "MEMBER_CREATE_FAILED",
      "The family member could not be created."
    );
  }

  const member =
    await getSafeMemberById(
      env,
      memberId
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Family member created.",

      requestedBy:
        ownerSession
          .displayName,

      generatedAt:
        sqliteUtcNow(),

      member,
    },
    200,
    origin
  );
}

async function handleOwnerMemberUpdate(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const ownerSession =
    await authenticateOwnerSession(
      request,
      body,
      env
    );

  const memberId =
    requireMemberId(
      body.memberId
    );

  await requireExistingMember(
    env,
    memberId
  );

  const displayName =
    requireMemberDisplayName(
      body.displayName
    );

  const now =
    sqliteUtcNow();

  await env.DB.prepare(
    `UPDATE members
     SET display_name = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      displayName,
      now,
      memberId
    )
    .run();

  const member =
    await getSafeMemberById(
      env,
      memberId
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Family member updated.",

      requestedBy:
        ownerSession
          .displayName,

      generatedAt:
        sqliteUtcNow(),

      member,
    },
    200,
    origin
  );
}

async function handleOwnerMemberCode(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const ownerSession =
    await authenticateOwnerSession(
      request,
      body,
      env
    );

  const memberId =
    requireMemberId(
      body.memberId
    );

  await requireExistingMember(
    env,
    memberId
  );

  const code =
    requireSixDigitCode(
      body.code
    );

  await ensureMemberCodeAvailable(
    env,
    code,
    memberId
  );

  const codeSalt =
    randomHex(16);

  const codeHash =
    await hmacHex(
      env.AUTH_SECRET,
      `${codeSalt}:${code}`
    );

  const now =
    sqliteUtcNow();

  await env.DB.prepare(
    `UPDATE members
     SET code_salt = ?,
         code_hash = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      codeSalt,
      codeHash,
      now,
      memberId
    )
    .run();

  const endedVisits =
    await closeActiveVisitsForMember(
      env,
      memberId,
      "code_changed",
      now
    );

  const member =
    await getSafeMemberById(
      env,
      memberId
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Family member access code changed. Existing sessions were revoked.",

      requestedBy:
        ownerSession
          .displayName,

      generatedAt:
        sqliteUtcNow(),

      endedVisits,

      member,
    },
    200,
    origin
  );
}

async function handleOwnerMemberStatus(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const ownerSession =
    await authenticateOwnerSession(
      request,
      body,
      env
    );

  const memberId =
    requireMemberId(
      body.memberId
    );

  const existingMember =
    await requireExistingMember(
      env,
      memberId
    );

  const isActive =
    requireBooleanValue(
      body.isActive,
      "isActive"
    );

  if (
    Number(
      existingMember.is_owner
    ) === 1 &&
    !isActive
  ) {
    throw new ApiError(
      400,
      "OWNER_ACCOUNT_PROTECTED",
      "The owner account cannot be deactivated."
    );
  }

  const now =
    sqliteUtcNow();

  await env.DB.prepare(
    `UPDATE members
     SET is_active = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      isActive
        ? 1
        : 0,
      now,
      memberId
    )
    .run();

  let endedVisits = 0;

  if (!isActive) {
    endedVisits =
      await closeActiveVisitsForMember(
        env,
        memberId,
        "member_deactivated",
        now
      );
  }

  const member =
    await getSafeMemberById(
      env,
      memberId
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        isActive
          ? "Family member activated."
          : "Family member deactivated.",

      requestedBy:
        ownerSession
          .displayName,

      generatedAt:
        sqliteUtcNow(),

      endedVisits,

      member,
    },
    200,
    origin
  );
}

async function handleOwnerMemberLogging(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const ownerSession =
    await authenticateOwnerSession(
      request,
      body,
      env
    );

  const memberId =
    requireMemberId(
      body.memberId
    );

  const existingMember =
    await requireExistingMember(
      env,
      memberId
    );

  const loggingEnabled =
    requireBooleanValue(
      body.loggingEnabled,
      "loggingEnabled"
    );

  if (
    Number(
      existingMember.is_owner
    ) === 1 &&
    loggingEnabled
  ) {
    throw new ApiError(
      400,
      "OWNER_LOGGING_PROTECTED",
      "Owner logging remains off unless Test Logging is used at login."
    );
  }

  const now =
    sqliteUtcNow();

  await env.DB.prepare(
    `UPDATE members
     SET logging_enabled = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      loggingEnabled
        ? 1
        : 0,
      now,
      memberId
    )
    .run();

  let endedVisits = 0;

  if (!loggingEnabled) {
    endedVisits =
      await closeActiveVisitsForMember(
        env,
        memberId,
        "logging_disabled",
        now
      );
  }

  const member =
    await getSafeMemberById(
      env,
      memberId
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        loggingEnabled
          ? "Family member logging enabled."
          : "Family member logging disabled.",

      requestedBy:
        ownerSession
          .displayName,

      generatedAt:
        sqliteUtcNow(),

      endedVisits,

      member,
    },
    200,
    origin
  );
}

function requireMemberId(
  value
) {
  const memberId =
    Number(value);

  if (
    !Number.isInteger(
      memberId
    ) ||
    memberId < 1
  ) {
    throw new ApiError(
      400,
      "MEMBER_ID_INVALID",
      "A valid family member ID is required."
    );
  }

  return memberId;
}

function requireMemberDisplayName(
  value
) {
  if (
    typeof value !==
    "string"
  ) {
    throw new ApiError(
      400,
      "MEMBER_NAME_INVALID",
      "A family member name is required."
    );
  }

  const displayName =
    value
      .replace(
        /[\u0000-\u001F\u007F]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (
    displayName.length < 1 ||
    displayName.length > 80
  ) {
    throw new ApiError(
      400,
      "MEMBER_NAME_INVALID",
      "The family member name must contain 1 to 80 characters."
    );
  }

  return displayName;
}

function requireSixDigitCode(
  value
) {
  const code =
    String(
      value || ""
    ).trim();

  if (
    !/^\d{6}$/.test(code)
  ) {
    throw new ApiError(
      400,
      "MEMBER_CODE_INVALID",
      "The family access code must contain exactly six digits."
    );
  }

  return code;
}

function requireBooleanValue(
  value,
  fieldName
) {
  if (
    typeof value !==
    "boolean"
  ) {
    throw new ApiError(
      400,
      "BOOLEAN_REQUIRED",
      `${fieldName} must be true or false.`
    );
  }

  return value;
}

async function requireExistingMember(
  env,
  memberId
) {
  const member =
    await env.DB.prepare(
      `SELECT
         id,
         display_name,
         is_active,
         is_owner,
         logging_enabled,
         created_at,
         updated_at
       FROM members
       WHERE id = ?
       LIMIT 1`
    )
      .bind(memberId)
      .first();

  if (!member) {
    throw new ApiError(
      404,
      "MEMBER_NOT_FOUND",
      "The requested family member was not found."
    );
  }

  return member;
}

async function getSafeMemberById(
  env,
  memberId
) {
  const member =
    await requireExistingMember(
      env,
      memberId
    );

  return {
    memberId:
      Number(
        member.id
      ),

    displayName:
      String(
        member.display_name
      ),

    isActive:
      Number(
        member.is_active
      ) === 1,

    isOwner:
      Number(
        member.is_owner
      ) === 1,

    loggingEnabled:
      Number(
        member.logging_enabled
      ) === 1,

    createdAt:
      member.created_at ||
      null,

    updatedAt:
      member.updated_at ||
      null,
  };
}

async function ensureMemberCodeAvailable(
  env,
  code,
  excludedMemberId = null
) {
  const memberResult =
    await env.DB.prepare(
      `SELECT
         id,
         code_salt,
         code_hash
       FROM members
       ORDER BY id`
    ).all();

  for (
    const member of
      memberResult.results ||
      []
  ) {
    if (
      excludedMemberId !==
        null &&
      Number(
        member.id
      ) ===
        Number(
          excludedMemberId
        )
    ) {
      continue;
    }

    const candidateHash =
      await hmacHex(
        env.AUTH_SECRET,
        `${member.code_salt}:` +
        `${code}`
      );

    if (
      secureEqualHex(
        candidateHash,
        String(
          member.code_hash ||
          ""
        )
      )
    ) {
      throw new ApiError(
        409,
        "MEMBER_CODE_IN_USE",
        "That six-digit code is already assigned."
      );
    }
  }
}

async function closeActiveVisitsForMember(
  env,
  memberId,
  reason,
  now
) {
  const visitResult =
    await env.DB.prepare(
      `SELECT
         id,
         session_token_hash
       FROM visits
       WHERE member_id = ?
         AND ended_at IS NULL
       ORDER BY id`
    )
      .bind(memberId)
      .all();

  const activeVisits =
    visitResult.results ||
    [];

  for (
    const visit of
      activeVisits
  ) {
    await closeVisit(
      env,
      Number(
        visit.id
      ),
      memberId,
      String(
        visit
          .session_token_hash ||
        ""
      ),
      reason,
      now
    );
  }

  return activeVisits.length;
}

function randomHex(
  byteLength
) {
  const bytes =
    new Uint8Array(
      byteLength
    );

  crypto.getRandomValues(
    bytes
  );

  return bytesToHex(
    bytes
  );
}

// ==========================================
// END BLOCK B
// ==========================================

async function handleOwnerVisitDetail(
  request,
  env,
  origin
) {
  const body =
    await readJson(request);

  const ownerSession =
    await authenticateOwnerSession(
      request,
      body,
      env
    );

  const visitId =
    Number(
      body.visitId
    );

  if (
    !Number.isInteger(
      visitId
    ) ||
    visitId < 1
  ) {
    throw new ApiError(
      400,
      "VISIT_ID_INVALID",
      "A valid visit ID is required."
    );
  }

  const visit =
    await env.DB.prepare(
      `SELECT
         v.id AS visit_id,
         v.member_id,
         m.display_name,
         v.started_at,
         v.last_activity_at,
         v.ended_at,
         v.end_reason,
         v.device_type,
         v.browser_family,
         v.client_timezone,
         (
           SELECT COUNT(*)
           FROM page_history AS ph
           WHERE ph.visit_id = v.id
         ) AS page_count,
         (
           SELECT COALESCE(
             SUM(
               COALESCE(
                 ph.duration_seconds,
                 0
               )
             ),
             0
           )
           FROM page_history AS ph
           WHERE ph.visit_id = v.id
         ) AS recorded_seconds
       FROM visits AS v
       JOIN members AS m
         ON m.id = v.member_id
       WHERE v.id = ?
         AND v.logging_enabled = 1
       LIMIT 1`
    )
      .bind(visitId)
      .first();

  if (!visit) {
    throw new ApiError(
      404,
      "VISIT_NOT_FOUND",
      "The requested visit was not found."
    );
  }

  const pageResult =
    await env.DB.prepare(
      `SELECT
         id AS page_entry_id,
         page_name,
         page_path,
         entered_at,
         left_at,
         duration_seconds,
         sequence_number
       FROM page_history
       WHERE visit_id = ?
       ORDER BY
         sequence_number ASC,
         id ASC`
    )
      .bind(visitId)
      .all();

  const pages =
    (
      pageResult.results ||
      []
    ).map(
      (row) => ({
        pageEntryId:
          Number(
            row.page_entry_id
          ),

        sequenceNumber:
          Number(
            row.sequence_number ||
            0
          ),

        pageName:
          String(
            row.page_name ||
            "Untitled page"
          ),

        pagePath:
          String(
            row.page_path ||
            "/"
          ),

        enteredAt:
          row.entered_at ||
          null,

        leftAt:
          row.left_at ||
          null,

        durationSeconds:
          row.duration_seconds ===
            null ||
          row.duration_seconds ===
            undefined
            ? null
            : Number(
                row
                  .duration_seconds
              ),

        status:
          row.left_at
            ? "closed"
            : "active",
      })
    );

  return jsonResponse(
    {
      status: "OK",

      message:
        "Owner visit detail retrieved.",

      requestedBy:
        ownerSession
          .displayName,

      generatedAt:
        sqliteUtcNow(),

      visit: {
        visitId:
          Number(
            visit.visit_id
          ),

        memberId:
          Number(
            visit.member_id
          ),

        displayName:
          String(
            visit.display_name
          ),

        startedAt:
          visit.started_at ||
          null,

        lastActivityAt:
          visit.last_activity_at ||
          null,

        endedAt:
          visit.ended_at ||
          null,

        endReason:
          visit.end_reason ||
          null,

        deviceType:
          visit.device_type ||
          "Unknown",

        browserFamily:
          visit.browser_family ||
          "Unknown",

        clientTimezone:
          visit.client_timezone ||
          "Unknown",

        pageCount:
          Number(
            visit.page_count ||
            0
          ),

        recordedSeconds:
          Number(
            visit.recorded_seconds ||
            0
          ),

        status:
          visit.ended_at
            ? "ended"
            : "active",
      },

      returnedPages:
        pages.length,

      pages,
    },
    200,
    origin
  );
}
