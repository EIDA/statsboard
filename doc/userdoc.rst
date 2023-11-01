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
`Statistcs Web Page <https://ws.resif.fr/eidaws/statistics/1/>`_ or in the
`Statistcs GitHub Repository <https://github.com/EIDA/eida-statistics>`_.

In order to visualize the output of the aforementioned Statistics service and
facilitate the draw of useful conclusions by the nodes' or networks' operators,
we designed another service, the current Statsboard, it being a dashboard
with which a user can make requests to the Statistics service and get plots
of the output depicted in their browser.

The service is intended to be open and able to be used by anyone from its
dedicated web page, currently hosted at
`Statsboard Web Page <https://orfeus-eu.org/data/eida/stats/>`_.
The need of authentication is limited to the data regarding networks the
operators of which have chosen to restrict from being public.


Installation
============

The service is not intended to be deployed at each node, but rather be used
from its dedicated web page. However, for the sake of completeness,
should anyone wish to use or deploy either locally or in a server
the current service, they can follow the instructions below.

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

Use the appropriate commands of npm to use or deploy either locally or in a server. ::

  $ npm start

OR ::

  $ npm run build

OR ::

  $ npm run deploy


Using the Service
=================

As mentioned above, the service can be used by anyone from its dedicated
web page, currently hosted at
`Statsboard Web Page <https://orfeus-eu.org/data/eida/stats/>`_.

Page Description
----------------

When loaded, the page consists of text and some HTML elements, which the user is
supposed to use to choose what data they wish to visualize. These elements
are the following:

* An Authentication checkbox: if the user checks it, they have to upload a
  token file to be authenticated as EIDA member. More information in the
  Authentication section below.

* A Start and an End time input field: users may specify the time period for which
  they wish to get visualized statistics information. The Start Time parameter is
  mandatory and when page is loaded it is set as the first month of current the year.

* A Level radio box: users can get visualized statistics information
  on EIDA, Node or Network level, that is information for the whole EIDA
  organization, for each node of the selected nodes within EIDA organization or
  for each network of the selected networks within EIDA organization. If the
  user is authenticated, Station level is also an option.

* Node, Network and Station input fields according to the Level specified: if the
  user has selected Node level, then a Node input field appears for the user to
  specify the nodes for which they want to get statistcs. The nodes can be
  given as a comma-separated list or selected by the provided autocompletion
  feature. Likewise, if the user has selected Network level, then a Node and
  a Network input fields appear with similar use; the Network input field autocompletion
  feature is set to show only the networks that exist to the nodes the user
  may have specified in the Node input field. Finally, if the user has selected
  Station level, then a Node, a Network and a Station input fields appear with similar
  use, except that the Station input field has no autocompletion feature.

* A Top N number input field if user has selected Network or Station Level:
  the user can select the number of networks or stations that will appear on the
  plots. Only the top N items will appear separately and all other items will be
  grouped together as one item for visualization purposes. If the Top N number is
  set to zero, then all items will appear separately, though this may make the plots
  hard to read, especially if too many items match the criteria the user has specified
  in the above mentioned input fields.

* A MAKE PLOTS button: when the user has specified their desire parameters through
  the above input fields and boxes, they may click on this button to get their
  visualized statistcs information. When the button is clicked, requests with the
  appropriate parameters are sent to the Statistics web service. At the same time a
  "Loading plots. Please wait..." message appears until the web service responds
  and all plots are created. When the page loads some default plots are automatically
  made. These are for EIDA Level from the start of current year until last month.

Authentication
--------------


Plots Description
-----------------
