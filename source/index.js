import { createPool } from 'mysql2/promise'
import { build } from '@tschtt/query-builder'

const database = await createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
  namedPlaceholders: true,
})

function parseResponse(response) {
  const result = { insertId: 0, affectedRows: 0, rows: [] }

  if (Array.isArray(response[0])) {
    result.rows = response[0]
    return result
  }

  result.insertId = response[0].insertId
  result.affectedRows = response[0].affectedRows

  return result
}

// query

export async function query(sql, values) {
  let result
  result = await database.query(sql, values)
  result = parseResponse(result)
  return result
}

// filter

export async function filter(table, where, options = {}) {
  const sql = ['select * from ??']
  const values = [table]

  where = build(where)

  if (where) {
    sql.push(`where ${where}`)
  }
  if (options.order && typeof options.order === 'string') {
    sql.push('order by ??')
    values.push(options.order)
  }
  if (options.order && Array.isArray(options.order) && options.order[1].toLowerCase() === 'asc') {
    sql.push('order by ?? asc')
    values.push(options.order[0])
  }
  if (options.order && Array.isArray(options.order) && options.order[1].toLowerCase() === 'desc') {
    sql.push('order by ?? desc')
    values.push(options.order[0])
  }
  if (options.limit) {
    sql.push('limit ?')
    values.push(options.limit)
  }
  if (options.limit && options.offset) {
    sql.push('offset ?')
    values.push(options.offset)
  }

  const result = await query(sql.join(' '), values)

  return result.rows
}

// find

export async function find(table, where, options = {}) {
  options.limit = 1
  const result = await filter(table, where, options)
  return result[0]
}

// create

export async function create(table, data) {
  if (Array.isArray(data)) return createMany(table, data)
  return createOne(table, data)
}

export async function createMany(table, rows) {
  const result = await query('insert into ::table (::columns) values :values', {
    table,
    columns: Object.keys(rows[0]),
    values: rows.map((row) => Object.values(row)),
  })
  return result.insertId
}

export async function createOne(table, row) {
  const result = await query('insert into ::table set :row', { table, row })
  return result.insertId
}

// update

export async function update(table, where, data) {
  const sql = ['update ::table set :data']
  const values = { table, data }

  where = build(where)

  if (where) {
    sql.push(`where ${where}`)
  }

  const result = await query(sql.join(' '), values)

  return result.affectedRows
}

export async function updateOne(table, where, data) {
  const sql = ['update ::table set :data']
  const values = { table, data }

  where = build(where)

  if (where) {
    sql.push(`where ${where}`)
  }

  sql.push('limit 1')

  const result = await query(sql.join(' '), values)

  return result.affectedRows
}

// upsert 

export async function upsert(table, where, data) {
  const item = await find(table, where)
  if(item) {
    await update(table, { id: item.id }, data)
    return item.id
  }
  return await create(table, data)
}

// remove

export async function remove(table, where) {
  const sql = ['delete from ::table']
  const values = { table }

  where = build(where)

  if (where) {
    sql.push(`where ${where}`)
  }

  const result = await query(sql.join(' '), values)

  return result.affectedRows
}

// table

export function table(name) {
  return {
    filter: (where, options = {}) => filter(name, where, options = {}),
    find: (where, options) => find(name, where, options),
    create: (data) => create(name, data),
    createMany: (rows) => createMany(name, rows),
    createOne: (row) => createOne(name, row),
    update: (where, data) => update(name, where, data),
    updateOne: (where, data) => updateOne(name, where, data),
    remove: (where) => remove(name, where),
  }
}

// database

export async function end () {
  await database.end()
}

export default {
  query,
  filter,
  find,
  create,
  createMany,
  createOne,
  update,
  updateOne,
  upsert,
  remove,
  table,
  end,
}
