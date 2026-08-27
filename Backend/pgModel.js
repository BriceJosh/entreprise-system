const { pool, formatDoc, formatDocs } = require('./db');

function generateId() {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

class QueryBuilder {
  constructor(tableName, filter = {}, ModelClass = null) {
    this.tableName = tableName;
    this.filter = filter;
    this.ModelClass = ModelClass;
    this._select = '*';
    this._sort = null;
    this._limit = null;
    this._populates = [];
    this._isSingle = false;
  }

  select(fields) {
    if (typeof fields === 'string') {
      const parts = fields.split(/\s+/).filter(Boolean);
      const excluded = parts.filter(p => p.startsWith('-')).map(p => p.slice(1));
      if (excluded.length > 0) {
        this._exclude = excluded;
      }
    }
    return this;
  }

  sort(order) {
    this._sort = order;
    return this;
  }

  limit(n) {
    this._limit = Number(n);
    return this;
  }

  populate(path, selectFields) {
    this._populates.push({ path, select: selectFields });
    return this;
  }

  lean() {
    this._lean = true;
    return this;
  }

  async exec() {
    const { whereClause, params } = buildWhere(this.filter);
    let sql = `SELECT * FROM ${this.tableName}`;
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    if (this._sort) {
      sql += buildOrderBy(this._sort);
    }
    if (this._limit) {
      sql += ` LIMIT ${this._limit}`;
    }

    const res = await pool.query(sql, params);
    let docs = formatDocs(res.rows);

    if (this._populates.length > 0) {
      docs = await executePopulates(docs, this._populates);
    }

    if (this._exclude && this._exclude.length > 0) {
      docs.forEach(doc => {
        this._exclude.forEach(field => {
          delete doc[field];
        });
      });
    }

    if (this._isSingle) {
      if (!docs || docs.length === 0) return null;
      return this.ModelClass && !this._lean ? new this.ModelClass(docs[0]) : docs[0];
    }

    if (this.ModelClass && !this._lean) {
      return docs.map(d => new this.ModelClass(d));
    }

    return docs;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}
function buildWhere(filter = {}) {
  const clauses = [];
  const params = [];

  for (const [key, val] of Object.entries(filter)) {
    if (val === undefined) continue;

    let col = key;
    if (key === '_id') col = 'id';

    if (val === null) {
      clauses.push(`${col} IS NULL`);
    } else if (typeof val === 'object' && val !== null) {
      if (val instanceof RegExp) {
        params.push(val.source.replace(/^\^|\$$/g, ''));
        clauses.push(`${col} ILIKE $${params.length}`);
      } else if (val.$regex) {
        let pattern = typeof val.$regex === 'string' ? val.$regex : val.$regex.source;
        pattern = pattern.replace(/^\^|\$$/g, '');
        params.push(pattern);
        clauses.push(`${col} ILIKE $${params.length}`);
      } else if (val.$in && Array.isArray(val.$in)) {
        params.push(val.$in.map(String));
        clauses.push(`${col} = ANY($${params.length})`);
      } else if (val.$gte !== undefined || val.$lte !== undefined || val.$gt !== undefined || val.$lt !== undefined) {
        if (val.$gte !== undefined) {
          params.push(val.$gte);
          clauses.push(`${col} >= $${params.length}`);
        }
        if (val.$gt !== undefined) {
          params.push(val.$gt);
          clauses.push(`${col} > $${params.length}`);
        }
        if (val.$lte !== undefined) {
          params.push(val.$lte);
          clauses.push(`${col} <= $${params.length}`);
        }
        if (val.$lt !== undefined) {
          params.push(val.$lt);
          clauses.push(`${col} < $${params.length}`);
        }
      } else if (val.$ne !== undefined) {
        params.push(val.$ne);
        clauses.push(`(${col} IS NULL OR ${col} != $${params.length})`);
      } else {
        params.push(val.toString());
        clauses.push(`${col} = $${params.length}`);
      }
    } else {
      params.push(val);
      clauses.push(`${col} = $${params.length}`);
    }
  }

  return {
    whereClause: clauses.length > 0 ? clauses.join(' AND ') : '',
    params
  };
}

function buildOrderBy(sort) {
  if (typeof sort === 'string') {
    const parts = sort.split(/\s+/).filter(Boolean);
    const sqlParts = parts.map(p => {
      if (p.startsWith('-')) return `${p.slice(1)} DESC`;
      return `${p} ASC`;
    });
    return ` ORDER BY ${sqlParts.join(', ')}`;
  } else if (typeof sort === 'object' && sort !== null) {
    const sqlParts = Object.entries(sort).map(([k, dir]) => {
      const col = k === '_id' ? 'id' : k === 'createdAt' ? 'created_at' : k;
      return `${col} ${dir === -1 || dir === 'desc' ? 'DESC' : 'ASC'}`;
    });
    return ` ORDER BY ${sqlParts.join(', ')}`;
  }
  return '';
}

async function executePopulates(docs, populates) {
  if (!Array.isArray(docs) || docs.length === 0) return docs;

  for (const pop of populates) {
    const field = pop.path;
    let targetTable = 'sites';
    if (field === 'site_id') targetTable = 'sites';
    if (field === 'user_id' || field === 'paiements.user_id') targetTable = 'users';
    if (field === 'recu_id') targetTable = 'recus';
    if (field === 'stock_id' || field === 'produit_id') targetTable = 'stocks';

    const ids = Array.from(new Set(docs.map(d => d[field]).filter(Boolean).map(String)));
    if (ids.length === 0) continue;

    const res = await pool.query(`SELECT * FROM ${targetTable} WHERE id = ANY($1)`, [ids]);
    const map = new Map(formatDocs(res.rows).map(r => [r.id, r]));

    docs.forEach(d => {
      if (d[field] && map.has(String(d[field]))) {
        d[field] = map.get(String(d[field]));
      }
    });
  }

  return docs;
}
function createModel(tableName, customMethods = {}) {
  class Model {
    constructor(data = {}) {
      Object.assign(this, data);
      if (!this.id && !this._id) {
        this.id = generateId();
        this._id = this.id;
      } else if (!this.id && this._id) {
        this.id = this._id;
      } else if (this.id && !this._id) {
        this._id = this.id;
      }

      // Attacher les méthodes personnalisées
      Object.assign(this, customMethods);
    }

    async save() {
      if (tableName === 'activites') {
        if (this.montant_total == null || Number(this.montant_total) === 0) {
          const q = Number(this.quantite) || 1;
          const p = Number(this.prix_unitaire) || 0;
          this.montant_total = Math.round(q * p);
        }
      }

      const keys = Object.keys(this).filter(k => !k.startsWith('_') && typeof this[k] !== 'function');
      if (this._id && !this.id) this.id = this._id;
      if (!keys.includes('id')) keys.push('id');

      const cols = [];
      const values = [];
      const placeholders = [];
      const updates = [];

      let i = 1;
      for (const k of keys) {
        let col = k;
        if (col === 'createdAt') col = 'created_at';
        if (col === 'updatedAt') col = 'updated_at';

        let val = this[k];
        if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
          if (val._id) {
            val = val._id;
          } else if (Array.isArray(val) || (k === 'lignes' || k === 'paiements')) {
            val = JSON.stringify(val);
          }
        }

        cols.push(col);
        values.push(val);
        placeholders.push(`$${i}`);
        if (col !== 'id' && col !== 'created_at') {
          updates.push(`${col} = EXCLUDED.${col}`);
        }
        i++;
      }

      const updateSql = updates.length > 0 ? ` DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()` : ' DO NOTHING';
      const sql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id)${updateSql} RETURNING *`;

      const res = await pool.query(sql, values);
      const savedDoc = formatDoc(res.rows[0]);
      Object.assign(this, savedDoc);
      this._id = this.id;
      return this;
    }

    async populate(path, selectFields) {
      const populated = await executePopulates([this], [{ path, select: selectFields }]);
      Object.assign(this, populated[0]);
      return this;
    }

    static find(filter = {}) {
      return new QueryBuilder(tableName, filter, Model);
    }

    static findOne(filter = {}) {
      const builder = new QueryBuilder(tableName, filter, Model);
      builder.limit(1);
      builder._isSingle = true;
      return builder;
    }

    static findById(id) {
      if (!id) {
        const builder = new QueryBuilder(tableName, { id: '__null__' }, Model);
        builder._isSingle = true;
        return builder;
      }
      const cleanId = id._id || id.id || id.toString();
      const builder = new QueryBuilder(tableName, { id: cleanId }, Model);
      builder.limit(1);
      builder._isSingle = true;
      return builder;
    }

    static async create(data) {
      if (Array.isArray(data)) {
        const created = [];
        for (const item of data) {
          const doc = new Model(item);
          await doc.save();
          created.push(doc);
        }
        return created;
      }
      const doc = new Model(data);
      await doc.save();
      return doc;
    }

    static async insertMany(data) {
      return this.create(data);
    }

    static async countDocuments(filter = {}) {
      const { whereClause, params } = buildWhere(filter);
      let sql = `SELECT COUNT(*) AS total FROM ${tableName}`;
      if (whereClause) sql += ` WHERE ${whereClause}`;
      const res = await pool.query(sql, params);
      return parseInt(res.rows[0].total, 10) || 0;
    }

    static async distinct(field, filter = {}) {
      const { whereClause, params } = buildWhere(filter);
      let col = field === '_id' ? 'id' : field;
      let sql = `SELECT DISTINCT ${col} FROM ${tableName}`;
      if (whereClause) sql += ` WHERE ${whereClause}`;
      const res = await pool.query(sql, params);
      return res.rows.map(r => r[col]);
    }

    static async deleteOne(filter = {}) {
      const { whereClause, params } = buildWhere(filter);
      let sql = `DELETE FROM ${tableName}`;
      if (whereClause) sql += ` WHERE ${whereClause}`;
      const res = await pool.query(sql, params);
      return { deletedCount: res.rowCount };
    }

    static async deleteMany(filter = {}) {
      return this.deleteOne(filter);
    }

    static async findByIdAndDelete(id) {
      if (!id) return null;
      const cleanId = id._id || id.id || id.toString();
      const existing = await this.findById(cleanId);
      if (existing) {
        await pool.query(`DELETE FROM ${tableName} WHERE id = $1`, [cleanId]);
      }
      return existing;
    }
  }

  return Model;
}

module.exports = {
  createModel,
  generateId
};
