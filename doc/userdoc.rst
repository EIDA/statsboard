User documentation
##################

Summary
=======

One of the aims of the
`European Integrated Data Archive <https://www.orfeus-eu.org/data/eida/>`_
(EIDA) is to provide transparent access and services to high quality, seismic
data across different data archives in Europe. In the context of exploring the
usability of these services and in particular the FDSN dataselect webservice,
we designed a new Statistics -or often called Logging- service, which stores
information about every request made using FDSN dataselect service within EIDA,
as well as provide access to this information using an API. More information
about this service can be found in the
`Statistcs GitHub Repository <https://github.com/EIDA/eida-statistics>`_. In
order to visualize the output of the aforementioned Statistics service and
facilitate the draw of useful conclusions by the nodes' or networks' Operators,
we designed another service, the current Statsboard, it being a dashboard
with which a user can make requests to the Statistics service and get plots
of the output depicted in their browser.

The service is intended to be open and able to be used by anyone. The need of
authentication is limited to the data regarding networks the operators of which
have chosen to restrict from being public.


Installation
============

License
-------

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see http://www.gnu.org/licenses/.

Requirements
------------

 * Node.js (version >= 18.0.0)

 * npm (version >= 9.0.0)

Download
--------

Download from GitHub. ::

 $ git clone https://github.com/EIDA/statsboard.git

Installation
------------

Move into the statsboard folder of the project and install the necessary libraries. ::

  $ cd statsboard/statsboard
  $ npm install

Deployment
----------

Use the appropriate commands of npm to deploy either locally or in a server. ::

  $ npm start

OR ::

  $ npm run build

OR ::

  $ npm run deploy


Using the Service
=================
