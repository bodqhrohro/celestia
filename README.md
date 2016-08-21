# Celestia Jabber bot

A hasty solution inspired by Isida, Sulci and all that stuff.
It's too dirty to stupid to be named after Princess Celestia though.

Features
========

* Watch for the conference and write logs
* Store links and give a link for a link
* Resent swearing (contains a Russian matchlist for now)
* Respond with mad Markov chains generated from chatlog.
  **May crash on first run** as chatlog is empty

Installation
============

This application is intended to run on Openshift Node.JS gear.
All you need is to clone this repo, run `npm i` and setup the configuration file.
If you want to run it another server, also assume Node.JS and npm are installed,
then set your port number and host IP in OPENSHIFT_NODEJS_PORT and
OPENSHIFT_NODEJS_IP environment variables respectively, also you need to
create files `stdout.log` and `error.log`.
