-- Migration: 001_initial_schema
-- Idempotent: all statements use CREATE TABLE IF NOT EXISTS
-- Requires: postgres:16 with pgcrypto or pg 13+ (gen_random_uuid built-in)

CREATE TABLE IF NOT EXISTS mines (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL,
  region        text        NOT NULL,
  mineral_type  text        NOT NULL
);

CREATE TABLE IF NOT EXISTS production_runs (
  id               uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  mine_id          uuid    NOT NULL REFERENCES mines(id) ON DELETE RESTRICT,
  period           date    NOT NULL,
  tonnage          numeric NOT NULL,
  ore_grade        numeric NOT NULL,
  equipment_hours  numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_entries (
  id       uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  mine_id  uuid    NOT NULL REFERENCES mines(id) ON DELETE RESTRICT,
  period   date    NOT NULL,
  driver   text    NOT NULL CHECK (driver IN ('fuel', 'supplies', 'equipment', 'labor')),
  amount   numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS supplies (
  id        uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  name      text  NOT NULL,
  unit      text  NOT NULL,
  category  text  NOT NULL CHECK (category IN ('fuel', 'explosives', 'reagents'))
);

CREATE TABLE IF NOT EXISTS supply_consumption (
  id         uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  mine_id    uuid    NOT NULL REFERENCES mines(id) ON DELETE RESTRICT,
  supply_id  uuid    NOT NULL REFERENCES supplies(id) ON DELETE RESTRICT,
  period     date    NOT NULL,
  quantity   numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id                uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name              text    NOT NULL,
  reliability_score numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id  uuid    NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  supply_id    uuid    NOT NULL REFERENCES supplies(id) ON DELETE RESTRICT,
  period       date    NOT NULL,
  unit_price   numeric NOT NULL,
  quantity     numeric NOT NULL
);
