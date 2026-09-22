/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';

const router = express.Router();

const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "MaintainIQ API Portal",
    version: "1.4.0",
    description: "Production API documentation and interactive testing sandbox for MaintainIQ - the intelligent asset maintenance and compliance management suite.",
    contact: {
      name: "MaintainIQ Support",
      email: "support@maintainiq.com"
    }
  },
  servers: [
    {
      url: "/api",
      description: "Relative API Endpoint Router"
    }
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "token",
        description: "JWT session token set on login/register."
      }
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          role: { type: "string", enum: ["Admin", "Technician"] },
          avatar: { type: "string" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      Asset: {
        type: "object",
        properties: {
          id: { type: "string" },
          assetName: { type: "string" },
          assetCode: { type: "string" },
          category: { type: "string" },
          location: { type: "string" },
          condition: { type: "string", enum: ["Excellent", "Good", "Fair", "Poor"] },
          status: { type: "string", enum: ["Operational", "Issue Reported", "Under Inspection", "Under Maintenance", "Out of Service", "Retired"] },
          assignedTechnician: { type: "string", nullable: true },
          assignedTechnicianName: { type: "string", nullable: true },
          lastService: { type: "string" },
          nextService: { type: "string" },
          qrCode: { type: "string", description: "Base64 encoded PNG QR code" },
          publicURL: { type: "string" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      Issue: {
        type: "object",
        properties: {
          id: { type: "string" },
          issueNumber: { type: "string" },
          assetId: { type: "string" },
          assetName: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
          category: { type: "string" },
          reporter: { type: "string" },
          status: { type: "string", enum: ["Reported", "Assigned", "Inspection Started", "Maintenance", "Waiting Parts", "Resolved", "Closed", "Reopened"] },
          aiGenerated: { type: "boolean" },
          possibleCauses: { type: "array", items: { type: "string" } },
          initialChecks: { type: "array", items: { type: "string" } },
          safetyWarning: { type: "string" },
          imageEvidence: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          completedDate: { type: "string", format: "date-time", nullable: true }
        }
      }
    }
  },
  paths: {
    "/auth/register": {
      post: {
        summary: "Public self-registration (always creates a Technician account)",
        description: "Admin accounts cannot be self-registered — use POST /auth/users as an Admin to provision one.",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  password: { type: "string", minLength: 6 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "Account created and signed in (JWT cookie set)." },
          409: { description: "Email already registered." },
          400: { description: "Missing or invalid parameters." }
        }
      }
    },
    "/auth/users": {
      post: {
        summary: "Provision an Admin or Technician account (Admin only)",
        tags: ["Authentication"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password", "role"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  password: { type: "string", minLength: 6 },
                  role: { type: "string", enum: ["Admin", "Technician"] }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "Account created (no session issued for the caller)." },
          403: { description: "Caller is not an Admin." },
          409: { description: "Email already registered." }
        }
      }
    },
    "/auth/login": {
      post: {
        summary: "Login existing user",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Authentication successful, cookie returned." },
          401: { description: "Invalid email or password." }
        }
      }
    },
    "/auth/profile": {
      get: {
        summary: "Retrieve current user profile details",
        tags: ["Authentication"],
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: "Profile retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" }
                  }
                }
              }
            }
          },
          401: { description: "Unauthenticated request." }
        }
      }
    },
    "/auth/technicians": {
      get: {
        summary: "List all registered technicians",
        tags: ["Authentication"],
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: "Technicians list retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    technicians: {
                      type: "array",
                      items: { $ref: "#/components/schemas/User" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/assets": {
      get: {
        summary: "List all assets with optional filtering",
        tags: ["Assets"],
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "Full-text search on name, code, or location" },
          { name: "status", in: "query", schema: { type: "string" }, description: "Filter by status" },
          { name: "category", in: "query", schema: { type: "string" }, description: "Filter by category" }
        ],
        responses: {
          200: {
            description: "Assets returned successfully (Cached via Redis/Memory)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    assets: { type: "array", items: { $ref: "#/components/schemas/Asset" } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: "Register new asset (Admin only)",
        tags: ["Assets"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["assetName", "assetCode", "category", "location"],
                properties: {
                  assetName: { type: "string" },
                  assetCode: { type: "string" },
                  category: { type: "string" },
                  location: { type: "string" },
                  condition: { type: "string", default: "Excellent" },
                  assignedTechnician: { type: "string" },
                  nextService: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "Asset created. Cache invalidated." }
        }
      }
    },
    "/assets/{id}": {
      get: {
        summary: "Retrieve full asset details by ID",
        tags: ["Assets"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Asset found." },
          404: { description: "Asset not found." }
        }
      },
      put: {
        summary: "Update existing asset metrics (Admin only)",
        tags: ["Assets"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Asset" }
            }
          }
        },
        responses: {
          200: { description: "Asset updated. Cache invalidated." }
        }
      },
      delete: {
        summary: "Delete/retire asset cascade (Admin only)",
        tags: ["Assets"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Asset successfully deleted and cascade complete." }
        }
      }
    },
    "/assets/public/{code}": {
      get: {
        summary: "Anonymous asset verification from public QR Code scan",
        tags: ["Assets"],
        parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Anonymized public inspection logs returned." }
        }
      }
    },
    "/assets/{id}/history": {
      get: {
        summary: "Get full chronological history for an asset",
        tags: ["Assets"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Asset history list." }
        }
      }
    },
    "/issues": {
      get: {
        summary: "Get filtered list of reported maintenance requests",
        tags: ["Issues"],
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "priority", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "assignedTo", in: "query", schema: { type: "string" } }
        ],
        responses: {
          200: { description: "Issues returned successfully." }
        }
      },
      post: {
        summary: "File a new maintenance issue",
        tags: ["Issues"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["assetId", "title", "description", "reporter"],
                properties: {
                  assetId: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string" },
                  category: { type: "string" },
                  reporter: { type: "string" },
                  aiGenerated: { type: "boolean" },
                  possibleCauses: { type: "array", items: { type: "string" } },
                  initialChecks: { type: "array", items: { type: "string" } },
                  safetyWarning: { type: "string" },
                  imageEvidence: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "Issue filed. Automatic asset status escalations performed." }
        }
      }
    },
    "/issues/triage-ai": {
      post: {
        summary: "Generate structural AI diagnostics and safety analysis",
        tags: ["Issues"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["description"],
                properties: {
                  description: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "AI generated structured diagnosis recommendations." }
        }
      }
    },
    "/issues/{id}": {
      put: {
        summary: "Update issue status, priority, or assign technician",
        tags: ["Issues"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  assignedTechnician: { type: "string" },
                  status: { type: "string" },
                  priority: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Issue progress logs updated successfully." }
        }
      }
    },
    "/issues/{id}/resolve": {
      post: {
        summary: "Formally close maintenance request with cost metrics (Admin/Technicians)",
        tags: ["Issues"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["inspectionNotes", "summary"],
                properties: {
                  inspectionNotes: { type: "string" },
                  summary: { type: "string" },
                  cost: { type: "number" },
                  parts: { type: "array", items: { type: "string" } },
                  evidence: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Maintenance log registered and issue resolved." }
        }
      }
    },
    "/issues/{id}/reopen": {
      post: {
        summary: "Reopen a Resolved or Closed issue (Admin only)",
        tags: ["Issues"],
        security: [{ cookieAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Issue moved back to Reopened status." },
          400: { description: "Issue is not currently Resolved or Closed." }
        }
      }
    },
    "/dashboard/stats": {
      get: {
        summary: "Get full operational insights (Asset counts, charts, expenditures)",
        tags: ["Dashboard Insights"],
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: "Consolidated system statistics." }
        }
      }
    },
    "/upload": {
      post: {
        summary: "Upload binary file evidence",
        tags: ["Upload Service"],
        security: [{ cookieAuth: [] }],
        description: "Submit binary attachments to be securely stored on Cloudinary cloud storage.",
        responses: {
          200: { description: "Attachment link successfully generated." }
        }
      }
    }
  }
};

router.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MaintainIQ API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.11.0/favicon-32x32.png" sizes="32x32" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui { background-color: #ffffff; border-radius: 12px; margin: 24px auto; max-width: 1200px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
    .header-bar { background-color: #1e293b; padding: 24px; color: #f8fafc; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #334155; }
    .header-bar h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.025em; }
    .header-bar span { font-size: 14px; opacity: 0.8; font-family: monospace; background: #0f172a; padding: 6px 12px; border-radius: 6px; border: 1px solid #475569; }
    /* Override Swagger themes slightly to be more readable and integrated */
    .swagger-ui .info .title { color: #0f172a !important; }
    .swagger-ui .scheme-container { background: #f1f5f9 !important; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="header-bar">
    <h1>🛠️ MaintainIQ API Portal</h1>
    <span>v1.4.0 (OpenAPI 3.0)</span>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const spec = ${JSON.stringify(openApiSpec)};
      const ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout"
      });
      window.ui = ui;
    };
  </script>
</body>
</html>
  `;
  res.send(html);
});

export default router;
