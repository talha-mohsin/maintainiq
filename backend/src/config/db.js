/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Asset from '../models/Asset.js';
import Issue from '../models/Issue.js';
import Maintenance from '../models/Maintenance.js';
import History from '../models/History.js';

// Setup in-memory store for model fallbacks
export const memoryStore = {
  User: [],
  Asset: [],
  Issue: [],
  Maintenance: [],
  History: []
};

// Helper function to filter plain objects in memory based on MongoDB query parameters
function filterData(data, query) {
  if (!query || Object.keys(query).length === 0) {
    return [...data];
  }

  return data.filter(item => {
    for (const [key, value] of Object.entries(query)) {
      if (key === '$or' && Array.isArray(value)) {
        const matchesOr = value.some(subQuery => filterData([item], subQuery).length > 0);
        if (!matchesOr) return false;
        continue;
      }

      const itemVal = item[key];

      // RegExp comparison
      if (value instanceof RegExp) {
        if (itemVal === undefined || itemVal === null || !value.test(String(itemVal))) {
          return false;
        }
        continue;
      }

      // Query sub-object containing operators
      if (value && typeof value === 'object' && ('$regex' in value || '$ne' in value || '$nin' in value || '$in' in value)) {
        if ('$regex' in value) {
          const regexPattern = value.$regex;
          const options = value.$options || '';
          const reg = regexPattern instanceof RegExp ? regexPattern : new RegExp(regexPattern, options);
          if (itemVal === undefined || itemVal === null || !reg.test(String(itemVal))) {
            return false;
          }
        }
        if ('$ne' in value) {
          if (String(itemVal) === String(value.$ne)) {
            return false;
          }
        }
        if ('$nin' in value && Array.isArray(value.$nin)) {
          const stringNin = value.$nin.map(v => String(v));
          if (stringNin.includes(String(itemVal))) {
            return false;
          }
        }
        if ('$in' in value && Array.isArray(value.$in)) {
          const stringIn = value.$in.map(v => String(v));
          if (!stringIn.includes(String(itemVal))) {
            return false;
          }
        }
        continue;
      }

      // Direct comparison
      if (String(itemVal) !== String(value)) {
        return false;
      }
    }
    return true;
  });
}

// Chainable query helper mimicking Mongoose promise queries
class InMemoryQuery {
  constructor(data) {
    this.data = data;
  }

  sort(sortOption) {
    if (sortOption) {
      const keys = Object.keys(sortOption);
      if (keys.length > 0) {
        const key = keys[0];
        const direction = sortOption[key];
        this.data.sort((a, b) => {
          const valA = a[key];
          const valB = b[key];
          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          
          let compare;
          if (valA instanceof Date && valB instanceof Date) {
            compare = valA.getTime() - valB.getTime();
          } else if (!isNaN(Date.parse(valA)) && !isNaN(Date.parse(valB)) && typeof valA === 'string') {
            compare = new Date(valA).getTime() - new Date(valB).getTime();
          } else {
            compare = String(valA).localeCompare(String(valB));
          }
          
          return (direction === -1 || direction === 'desc') ? -compare : compare;
        });
      }
    }
    return this;
  }

  limit(num) {
    this.data = this.data.slice(0, num);
    return this;
  }

  then(onFulfilled, onRejected) {
    return Promise.resolve(this.data).then(onFulfilled, onRejected);
  }
}

// Save monkeypatch
const originalSave = mongoose.Model.prototype.save;
mongoose.Model.prototype.save = async function(...args) {
  if (mongoose.connection.readyState !== 1) {
    const modelName = this.constructor.modelName;
    const store = memoryStore[modelName];
    if (!store) return this;

    const data = this.toObject ? this.toObject({ virtuals: true }) : { ...this._doc };
    if (!data._id) {
      data._id = this._id || `${modelName.toLowerCase()}-${Date.now()}`;
    }

    const index = store.findIndex(item => String(item._id) === String(data._id));
    if (index >= 0) {
      store[index] = data;
    } else {
      store.push(data);
    }
    return this;
  }
  return originalSave.apply(this, args);
};

// Find monkeypatch
const originalFind = mongoose.Model.find;
mongoose.Model.find = function(query, ...args) {
  if (mongoose.connection.readyState !== 1) {
    const modelName = this.modelName;
    const store = memoryStore[modelName] || [];
    const filtered = filterData(store, query);
    return new InMemoryQuery(filtered);
  }
  return originalFind.apply(this, [query, ...args]);
};

// FindOne monkeypatch
const originalFindOne = mongoose.Model.findOne;
mongoose.Model.findOne = function(query, ...args) {
  if (mongoose.connection.readyState !== 1) {
    const modelName = this.modelName;
    const store = memoryStore[modelName] || [];
    const filtered = filterData(store, query);
    const result = filtered[0] || null;
    return {
      then(onFulfilled, onRejected) {
        return Promise.resolve(result).then(onFulfilled, onRejected);
      }
    };
  }
  return originalFindOne.apply(this, [query, ...args]);
};

// FindById monkeypatch
const originalFindById = mongoose.Model.findById;
mongoose.Model.findById = function(id, ...args) {
  if (mongoose.connection.readyState !== 1) {
    const modelName = this.modelName;
    const store = memoryStore[modelName] || [];
    const result = store.find(item => String(item._id) === String(id)) || null;
    return {
      then(onFulfilled, onRejected) {
        return Promise.resolve(result).then(onFulfilled, onRejected);
      }
    };
  }
  return originalFindById.apply(this, [id, ...args]);
};

// CountDocuments monkeypatch
const originalCountDocuments = mongoose.Model.countDocuments;
mongoose.Model.countDocuments = function(query, ...args) {
  if (mongoose.connection.readyState !== 1) {
    const modelName = this.modelName;
    const store = memoryStore[modelName] || [];
    const filtered = filterData(store, query);
    const count = filtered.length;
    return {
      then(onFulfilled, onRejected) {
        return Promise.resolve(count).then(onFulfilled, onRejected);
      }
    };
  }
  return originalCountDocuments.apply(this, [query, ...args]);
};

// InsertMany monkeypatch
const originalInsertMany = mongoose.Model.insertMany;
mongoose.Model.insertMany = async function(docs, ...args) {
  if (mongoose.connection.readyState !== 1) {
    const modelName = this.modelName;
    const store = memoryStore[modelName];
    if (!store) return docs;

    const inserted = docs.map(doc => {
      const plain = doc.toObject ? doc.toObject({ virtuals: true }) : { ...doc };
      if (!plain._id) {
        plain._id = doc._id || `${modelName.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }
      store.push(plain);
      return plain;
    });
    return inserted;
  }
  return originalInsertMany.apply(this, [docs, ...args]);
};

// DeleteMany monkeypatch
const originalDeleteMany = mongoose.Model.deleteMany;
mongoose.Model.deleteMany = function(query, ...args) {
  if (mongoose.connection.readyState !== 1) {
    const modelName = this.modelName;
    const store = memoryStore[modelName] || [];
    const filtered = filterData(store, query);
    const deletedIds = filtered.map(item => String(item._id));
    memoryStore[modelName] = store.filter(item => !deletedIds.includes(String(item._id)));
    const result = { deletedCount: deletedIds.length };
    return {
      then(onFulfilled, onRejected) {
        return Promise.resolve(result).then(onFulfilled, onRejected);
      }
    };
  }
  return originalDeleteMany.apply(this, [query, ...args]);
};

// FindByIdAndDelete monkeypatch
const originalFindByIdAndDelete = mongoose.Model.findByIdAndDelete;
mongoose.Model.findByIdAndDelete = function(id, ...args) {
  if (mongoose.connection.readyState !== 1) {
    const modelName = this.modelName;
    const store = memoryStore[modelName] || [];
    const index = store.findIndex(item => String(item._id) === String(id));
    let deletedDoc = null;
    if (index >= 0) {
      deletedDoc = store.splice(index, 1)[0];
    }
    return {
      then(onFulfilled, onRejected) {
        return Promise.resolve(deletedDoc).then(onFulfilled, onRejected);
      }
    };
  }
  return originalFindByIdAndDelete.apply(this, [id, ...args]);
};

// FindByIdAndUpdate monkeypatch
const originalFindByIdAndUpdate = mongoose.Model.findByIdAndUpdate;
mongoose.Model.findByIdAndUpdate = function(id, update, options, ...args) {
  if (mongoose.connection.readyState !== 1) {
    const modelName = this.modelName;
    const store = memoryStore[modelName] || [];
    const index = store.findIndex(item => String(item._id) === String(id));
    if (index >= 0) {
      const current = store[index];
      const updated = { ...current, ...update };
      store[index] = updated;
      return {
        then(onFulfilled, onRejected) {
          return Promise.resolve(updated).then(onFulfilled, onRejected);
        }
      };
    }
    return {
      then(onFulfilled, onRejected) {
        return Promise.resolve(null).then(onFulfilled, onRejected);
      }
    };
  }
  return originalFindByIdAndUpdate.apply(this, [id, update, options, ...args]);
};

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("❌ CRITICAL PRODUCTION ERROR: MONGODB_URI is required in production environment (outside sandbox mode). Server start aborted.");
    }
    console.warn("⚠️ MONGODB_URI is not set in environment variables. Falling back to high-fidelity In-Memory Database Fallback to keep the application active in preview mode...");
    await seedDatabase();
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log("🔌 MongoDB Atlas connected successfully");
    await seedDatabase();
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`❌ CRITICAL PRODUCTION ERROR: MongoDB connection failed in production mode: ${error.message}. Server start aborted.`);
    }
    console.log("⚠️ Falling back to high-fidelity In-Memory Database Fallback to keep the application active in preview mode...");
    await seedDatabase();
  }
}

async function seedDatabase() {
  try {
    // Seed Users
    const adminUser = await User.findOne({ email: 'admin@maintainiq.com' });
    if (!adminUser) {
      console.log("🌱 Seeding Users collection...");
      const salt = bcrypt.genSaltSync(10);
      const adminPassword = bcrypt.hashSync('admin123', salt);
      const techPassword = bcrypt.hashSync('tech123', salt);

      const users = [
        {
          _id: 'usr-1',
          name: 'Sarah Jenkins',
          email: 'admin@maintainiq.com',
          password: adminPassword,
          role: 'Admin',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          createdAt: new Date('2026-01-15T08:00:00Z')
        },
        {
          _id: 'usr-2',
          name: 'Marcus Vance',
          email: 'tech@maintainiq.com',
          password: techPassword,
          role: 'Technician',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
          createdAt: new Date('2026-01-16T09:30:00Z')
        },
        {
          _id: 'usr-3',
          name: 'John Doe',
          email: 'john@maintainiq.com',
          password: techPassword,
          role: 'Technician',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          createdAt: new Date('2026-02-01T10:00:00Z')
        }
      ];
      await User.insertMany(users);
      console.log("✅ Users seeded successfully!");
    }

    // Seed Assets
    const testAsset = await Asset.findOne({ _id: 'ast-1' });
    if (!testAsset) {
      console.log("🌱 Seeding Assets collection...");
      const assets = [
        {
          _id: 'ast-1',
          assetName: 'HVAC Server Room AC-01',
          assetCode: 'HVAC-SR1-01',
          category: 'HVAC',
          location: 'Server Room A, 4th Floor',
          condition: 'Fair',
          status: 'Operational',
          assignedTechnician: 'usr-2',
          assignedTechnicianName: 'Marcus Vance',
          lastService: '2026-06-10',
          nextService: '2026-09-10',
          qrCode: '',
          publicURL: '/public/asset/HVAC-SR1-01',
          createdBy: 'usr-1',
          createdAt: new Date('2026-02-10T14:22:00Z')
        },
        {
          _id: 'ast-2',
          assetName: 'Main Passenger Elevator B',
          assetCode: 'ELEV-MAIN-B',
          category: 'Transportation',
          location: 'Central Lobby, East Wing',
          condition: 'Excellent',
          status: 'Operational',
          assignedTechnician: null,
          assignedTechnicianName: null,
          lastService: '2026-07-01',
          nextService: '2026-10-01',
          qrCode: '',
          publicURL: '/public/asset/ELEV-MAIN-B',
          createdBy: 'usr-1',
          createdAt: new Date('2026-02-12T11:05:00Z')
        },
        {
          _id: 'ast-3',
          assetName: 'Backup Diesel Generator PWR-3',
          assetCode: 'GEN-PWR-03',
          category: 'Electrical',
          location: 'Sub-Basement Utility Room 2',
          condition: 'Poor',
          status: 'Under Maintenance',
          assignedTechnician: 'usr-3',
          assignedTechnicianName: 'John Doe',
          lastService: '2026-05-14',
          nextService: '2026-08-14',
          qrCode: '',
          publicURL: '/public/asset/GEN-PWR-03',
          createdBy: 'usr-1',
          createdAt: new Date('2026-02-15T09:40:00Z')
        }
      ];
      await Asset.insertMany(assets);
      console.log("✅ Assets seeded successfully!");
    }

    // Seed Issues
    const testIssue = await Issue.findOne({ _id: 'iss-1' });
    if (!testIssue) {
      console.log("🌱 Seeding Issues collection...");
      const issues = [
        {
          _id: 'iss-1',
          issueNumber: 'REQ-1001',
          assetId: 'ast-1',
          assetName: 'HVAC Server Room AC-01',
          title: 'AC Leaking Water & Making Loud Vibrating Noise',
          description: 'The AC unit in the main server room is dripping water directly onto Rack B. There is also a continuous grinding/vibrating noise coming from the fan motor housing, and temperature is rising slowly.',
          priority: 'Critical',
          category: 'HVAC',
          reporter: 'David Finch (IT Admin)',
          status: 'Assigned',
          aiGenerated: true,
          possibleCauses: [
            'Clogged condensate drain line causing overflow.',
            'Loose fan motor mounting brackets or worn fan bearings.',
            'Evaporator coil freezing due to low refrigerant or dirty filters.'
          ],
          initialChecks: [
            'Verify condensate drain is clear and drip pan is not cracked.',
            'Check fan assembly and housing for loose screws or bearing play.',
            'Inspect air filters and check evaporator coil for frost build-up.'
          ],
          safetyWarning: 'HIGH VOLTAGE: Shut off power at breaker HVAC-B4 before opening fan motor housing. Avoid water contact with active server racks.',
          assignedTechnician: 'usr-2',
          assignedTechnicianName: 'Marcus Vance',
          imageEvidence: null,
          createdAt: new Date('2026-07-10T15:30:00Z'),
          completedDate: null
        },
        {
          _id: 'iss-2',
          issueNumber: 'REQ-1002',
          assetId: 'ast-3',
          assetName: 'Backup Diesel Generator PWR-3',
          title: 'Battery Voltage Low Error during Weekly Run Test',
          description: 'Weekly diagnostic self-test flagged failure code ERR-BAT-VOLT. Starting motor struggled to crank and voltage registered at 11.2V instead of the normal 24V charger float.',
          priority: 'High',
          category: 'Electrical',
          reporter: 'System Automated Diagnostics',
          status: 'Inspection Started',
          aiGenerated: true,
          possibleCauses: [
            'Failing lead-acid starter battery cell.',
            'Malfunctioning trickle charger unit or blown fuses.',
            'Loose or corroded battery terminal cables.'
          ],
          initialChecks: [
            'Test battery open-circuit voltage and load-test the cells.',
            'Verify battery charger output current and voltage settings.',
            'Clean and tighten all battery connections.'
          ],
          safetyWarning: 'ACID & SPARK HAZARD: Always wear eye protection. Use insulated tools. Vent battery room to avoid hydrogen gas accumulation.',
          assignedTechnician: 'usr-3',
          assignedTechnicianName: 'John Doe',
          imageEvidence: null,
          createdAt: new Date('2026-07-11T08:15:00Z'),
          completedDate: null
        },
        {
          _id: 'iss-3',
          issueNumber: 'REQ-1003',
          assetId: 'ast-2',
          assetName: 'Main Passenger Elevator B',
          title: 'Cabin Indicator Lights Flickering on Floors 3-5',
          description: 'The floor indicator light inside Cabin B flickers and sometimes goes dark when traveling between floors 3 and 5. Elevator is operating normally otherwise.',
          priority: 'Low',
          category: 'Transportation',
          reporter: 'Receptionist Desk',
          status: 'Closed',
          aiGenerated: false,
          possibleCauses: [
            'Loose ribbon cable connector behind control panel.',
            'Failing LED display segment.'
          ],
          initialChecks: [
            'Check ribbon connections inside cabin car header panel.',
            'Test voltage to the cabin display board.'
          ],
          safetyWarning: 'Lockout/tagout elevator controls before removing the cabin internal panel plates.',
          assignedTechnician: 'usr-2',
          assignedTechnicianName: 'Marcus Vance',
          imageEvidence: null,
          createdAt: new Date('2026-07-01T10:00:00Z'),
          completedDate: new Date('2026-07-02T14:30:00Z')
        }
      ];
      await Issue.insertMany(issues);
      console.log("✅ Issues seeded successfully!");
    }

    // Seed Maintenances
    const testMaint = await Maintenance.findOne({ _id: 'maint-1' });
    if (!testMaint) {
      console.log("🌱 Seeding Maintenances collection...");
      const maintenances = [
        {
          _id: 'maint-1',
          issueId: 'iss-3',
          assetId: 'ast-2',
          inspectionNotes: 'Located loose ribbon cable connector under the main operating panel. Ribbon pins were dusty but otherwise intact. display board is in good working order.',
          parts: ['Display Ribbon Cable Spacer (OEM-114)', 'Contact Cleaner Spray'],
          cost: 45.00,
          evidence: null,
          maintenanceDate: new Date('2026-07-02T13:00:00Z'),
          completedDate: new Date('2026-07-02T14:30:00Z'),
          summary: 'Tightened internal connectors, sprayed anti-corrosion cleaning agent on terminals, and secured ribbon cable in place. Reassembled and tested successfully through 15 run cycles.'
        }
      ];
      await Maintenance.insertMany(maintenances);
      console.log("✅ Maintenances seeded successfully!");
    }

    // Seed History
    const testHistory = await History.findOne({ _id: 'hst-1' });
    if (!testHistory) {
      console.log("🌱 Seeding History collection...");
      const history = [
        {
          _id: 'hst-1',
          assetId: 'ast-1',
          action: 'Asset Registered',
          performedBy: 'Sarah Jenkins (Admin)',
          issueId: null,
          timestamp: new Date('2026-02-10T14:22:00Z')
        },
        {
          _id: 'hst-2',
          assetId: 'ast-2',
          action: 'Asset Registered',
          performedBy: 'Sarah Jenkins (Admin)',
          issueId: null,
          timestamp: new Date('2026-02-12T11:05:00Z')
        },
        {
          _id: 'hst-3',
          assetId: 'ast-3',
          action: 'Asset Registered',
          performedBy: 'Sarah Jenkins (Admin)',
          issueId: null,
          timestamp: new Date('2026-02-15T09:40:00Z')
        },
        {
          _id: 'hst-4',
          assetId: 'ast-2',
          action: 'Issue Reported',
          performedBy: 'Receptionist Desk',
          issueId: 'iss-3',
          timestamp: new Date('2026-07-01T10:00:00Z')
        },
        {
          _id: 'hst-5',
          assetId: 'ast-2',
          action: 'Assigned',
          performedBy: 'Sarah Jenkins (Admin)',
          issueId: 'iss-3',
          timestamp: new Date('2026-07-01T11:00:00Z')
        },
        {
          _id: 'hst-6',
          assetId: 'ast-2',
          action: 'Maintenance Completed',
          performedBy: 'Marcus Vance (Technician)',
          issueId: 'iss-3',
          timestamp: new Date('2026-07-02T14:30:00Z')
        },
        {
          _id: 'hst-7',
          assetId: 'ast-1',
          action: 'Issue Reported',
          performedBy: 'David Finch (IT Admin)',
          issueId: 'iss-1',
          timestamp: new Date('2026-07-10T15:30:00Z')
        },
        {
          _id: 'hst-8',
          assetId: 'ast-1',
          action: 'Assigned',
          performedBy: 'Sarah Jenkins (Admin)',
          issueId: 'iss-1',
          timestamp: new Date('2026-07-10T16:00:00Z')
        },
        {
          _id: 'hst-9',
          assetId: 'ast-3',
          action: 'Issue Reported',
          performedBy: 'System Diagnostics',
          issueId: 'iss-2',
          timestamp: new Date('2026-07-11T08:15:00Z')
        }
      ];
      await History.insertMany(history);
      console.log("✅ History seeded successfully!");
    }
  } catch (error) {
    console.error("❌ Seeding database error:", error);
  }
}
