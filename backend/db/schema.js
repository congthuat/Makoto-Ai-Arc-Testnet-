const { pgTable, serial, text, integer, timestamp, jsonb, bigint, index, boolean } = require('drizzle-orm/pg-core')

// Wallet-based users. Address is stored lowercase.
exports.mk_users = pgTable('mk_users', {
  address: text('address').primaryKey(),
  credits: integer('credits').notNull().default(0),
  total_deposited_credits: integer('total_deposited_credits').notNull().default(0),
  total_spent_credits: integer('total_spent_credits').notNull().default(0),
  language: text('language').default('vi'),
  model: text('model').default('fast'),
  watchlist_seeded: boolean('watchlist_seeded').notNull().default(false),
  // Google account (users sign in with Google; `address` holds 'g:<google sub>' for them).
  email: text('email'),
  name: text('name'),
  avatar: text('avatar'),
  // Wallet linked in Settings → Connections (lowercase 0x…), used for top-ups and "my wallet".
  wallet: text('wallet'),
  created_at: timestamp('created_at').defaultNow(),
})

exports.mk_nonces = pgTable('mk_nonces', {
  address: text('address').primaryKey(),
  nonce: text('nonce').notNull(),
  created_at: timestamp('created_at').defaultNow(),
})

exports.mk_sessions = pgTable('mk_sessions', {
  token: text('token').primaryKey(),
  address: text('address').notNull(),
  created_at: timestamp('created_at').defaultNow(),
})

exports.mk_conversations = pgTable('mk_conversations', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  title: text('title').notNull().default('New chat'),
  pinned: boolean('pinned').notNull().default(false),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (t) => ({ byAddress: index('mk_conv_address_idx').on(t.address) }))

exports.mk_messages = pgTable('mk_messages', {
  id: serial('id').primaryKey(),
  conversation_id: integer('conversation_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull().default(''),
  steps: jsonb('steps'),
  widgets: jsonb('widgets'),
  credits: integer('credits').default(0),
  model: text('model'),
  suggestions: jsonb('suggestions'),
  feedback: integer('feedback'),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => ({ byConv: index('mk_msg_conv_idx').on(t.conversation_id) }))

exports.mk_deposits = pgTable('mk_deposits', {
  tx_hash: text('tx_hash').primaryKey(),
  address: text('address').notNull(),
  amount_usdc: text('amount_usdc').notNull(),
  credits: integer('credits').notNull(),
  block_number: bigint('block_number', { mode: 'number' }),
  created_at: timestamp('created_at').defaultNow(),
})

exports.mk_ledger = pgTable('mk_ledger', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  ref: text('ref'),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => ({ byAddr: index('mk_ledger_address_idx').on(t.address) }))

// Tokens a user follows on the home screen.
exports.mk_watchlist = pgTable('mk_watchlist', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  symbol: text('symbol').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => ({ byAddr: index('mk_watch_address_idx').on(t.address) }))

// One AI market briefing per user per day.
exports.mk_briefings = pgTable('mk_briefings', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  day: text('day').notNull(),
  lang: text('lang'),
  content: jsonb('content').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => ({ byAddrDay: index('mk_brief_addr_day_idx').on(t.address, t.day) }))

// "Kiểm kèo" — fact-checks of crypto calls / tokens.
exports.mk_checks = pgTable('mk_checks', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  input: text('input').notNull(),
  lang: text('lang'),
  score: integer('score'),
  verdict: text('verdict'),
  symbol: text('symbol'),
  result: jsonb('result').notNull(),
  credits: integer('credits').default(0),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => ({ byAddr: index('mk_checks_address_idx').on(t.address) }))

// Long-term memory: durable facts Makoto learned about the user (holdings, risk appetite, goals…).
exports.mk_memories = pgTable('mk_memories', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  content: text('content').notNull(),
  category: text('category').default('other'),
  source: text('source').default('chat'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (t) => ({ byAddr: index('mk_memories_address_idx').on(t.address) }))

// Per-user memory switch (row exists only when the user turned memory off).
exports.mk_memory_prefs = pgTable('mk_memory_prefs', {
  address: text('address').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  updated_at: timestamp('updated_at').defaultNow(),
})

// "Dự án" — projects a user saved (table name kept from the earlier airdrop page; `done` is unused).
exports.mk_airdrop_tracks = pgTable('mk_airdrop_tracks', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  akey: text('akey').notNull(),
  name: text('name').notNull(),
  logo: text('logo'),
  done: jsonb('done').default([]),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => ({ byAddr: index('mk_airdrop_tracks_addr_idx').on(t.address, t.akey) }))
