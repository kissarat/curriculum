-- create database curriculum;
drop table if exists  notification;
drop table if exists  doc;
drop table if exists  timetable;
drop table if exists  subject;
drop table if exists  member;

create table member (
  id char(16) unique primary key,
  email varchar(64) not null unique,
  password varchar(256) not null,
  password_hash varchar(256) not null,
  salt varchar(64),
  first_name varchar(32) not null,
  last_name varchar(32) not null,
  kind smallint not null default 1
);

create table subject (
  id char(16) primary key,
  "name" varchar(128),
  color int
);

create table timetable (
  id serial primary key,
  subject char(16) not null references subject(id),
  teacher char(16) not null references member(id),
  course varchar(128),
  start_date date,
  end_date date
);

create table doc (
  id serial,
  subject char(16) not null references subject(id),
  "name" varchar(128),
  link varchar(256)
);

create table notification (
  id serial primary key,
  subject char(16) references subject(id),
  whom char(16) references member(id),
  "when" date,
  body text
);
