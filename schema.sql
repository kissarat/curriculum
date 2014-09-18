-- create database curriculum;
drop table if exists  notification;
drop table if exists  timetable;
drop table if exists  course;
drop table if exists  room;
drop table if exists  "group";
drop table if exists  student_doc;
drop table if exists  doc;
drop table if exists  subject;
drop table if exists  member;
-- drop view if exists  columns;

create table member (
  id char(16) unique primary key,
  email varchar(64) not null unique,
--   password varchar(256) not null,
  password_hash varchar(256) not null,
  salt varchar(64),
  first_name varchar(32) not null,
  last_name varchar(32) not null,
  "role" smallint not null default 1
);
--
-- insert into member values (
--   'admin', 'kissarat@gmail.com', 'admin',
--   '0DPiKuNIrrVmD8IUCuw1hQxNqZc=', 'admin',
--   'Taras', 'Labiak', 0);

create table subject (
  id char(16) primary key,
  "name" varchar(128),
  color int
);

create table "group" (
  id serial unique,
  student char(16) references member(id)
);

create table course (
  id serial unique,
  subject char(16) references subject(id),
  "group" int references "group"(id),
  start_date date,
  end_date date
);

create table room (
  id serial unique,
  number smallint,
  building varchar(128)
);

create table timetable (
  course int references course(id),
  week_day smallint,
  "time" time,
  duration interval,
  room int references room(id)
);

create table doc (
  id serial unique,
  subject char(16) not null references subject(id),
  "name" varchar(128),
  link varchar(256)
);

create table student_doc (
  id int references doc(id),
  student char(16) references member(id),
  doc int references doc(id)
);

create table notification (
  id serial primary key,
  subject char(16) references subject(id),
  whom char(16) references member(id),
  "when" date,
  body text
);
/*
create view columns as
SELECT
  c.table_name as "table",
  c.column_name as "column",
  c.data_type as "type",
  c.character_maximum_length as "length",
  is_nullable,
  c.column_default as "default",
  r.table_name as "foreign_table",
  r.table_name as "foreign_column"
FROM information_schema.columns as c
  join information_schema.key_column_usage as k
    on c.table_name = k.table_name and c.column_name = k.column_name
  join information_schema.constraint_column_usage as r
    on k.constraint_name = r.constraint_name
  where c.table_schema='public'
  order by "table", ordinal_position;*/