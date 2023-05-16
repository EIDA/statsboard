import Plotly from 'plotly.js-dist';

export function makePlotsEIDA(startTime, endTime) {

  totalPlots();
  monthAndYearPlots("month");
  monthAndYearPlots("year");
  mapPlots();

  function totalPlots() {
    const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&format=json`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        // clients plot
        const indicatorDataClients = [
          {
            type: "indicator",
            value: data.results[0].clients,
            mode: "number",
            number: { font: { size: 50 } }
          }
        ];
        const indicatorLayoutClients = {
          title: "Total number of unique users"
        };
        Plotly.newPlot("total-clients", indicatorDataClients, indicatorLayoutClients, {displaylogo: false});

        // bytes plot
        const indicatorDataBytes = [
          {
            type: "indicator",
            value: data.results[0].bytes,
            mode: "number",
            number: { font: { size: 50 } }
          }
        ];
        const indicatorLayoutBytes = {
          title: "Total number of bytes"
        };
        Plotly.newPlot("total-bytes", indicatorDataBytes, indicatorLayoutBytes, {displaylogo: false});

        // requests plot
        const pieDataRequests = [
          {
            values: [data.results[0].nb_successful_reqs, data.results[0].nb_reqs - data.results[0].nb_successful_reqs],
            labels: ["Successful Requests", "Unsuccessful Requests"],
            type: "pie",
          },
        ];
        const pieLayoutRequests = {
          title: "Total number of requests"
        };
        Plotly.newPlot("total-requests", pieDataRequests, pieLayoutRequests, {displaylogo: false});
      })
      .catch((error) => console.log(error));
    }

    function monthAndYearPlots(details = "month") {
      let url = null;
      if (details === "year") {
        url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&details=year&format=json`;
      }
      else {
        url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&details=month&format=json`;
      }
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          // show clients at first
          const barData = [
            {
              x: data.results.map(result => result.date),
              y: data.results.map(result => result.clients),
              name: "",
              type: 'bar'
            },
            {}
          ];
          let barLayout = {
            title: 'Number of unique users per '+details,
            xaxis: {
              title: details.charAt(0).toUpperCase() + details.slice(1),
              tickmode: 'linear'
            },
            yaxis: {
              title: 'Unique users'
            },
            updatemenus: [{
              buttons: [
                // clients button
                {
                  args: [
                    {
                      x: [data.results.map(result => result.date)],
                      y: [data.results.map(result => result.clients), []],
                      name: ["", ""],
                      type: 'bar'
                    },
                    {
                      title: 'Number of unique users per '+details,
                      yaxis: {
                        title: 'Unique users'
                      },
                      showlegend: false
                    }
                  ],
                  label: 'Unique Users',
                  method: 'update'
                },
                // bytes button
                {
                  args: [
                    {
                      x: [data.results.map(result => result.date)],
                      y: [data.results.map(result => result.bytes), []],
                      name: ["", ""],
                      type: 'bar'
                    },
                    {
                      title: 'Number of bytes per '+details,
                      yaxis: {
                        title: 'Bytes'
                      },
                      showlegend: false
                    }
                  ],
                  label: 'Bytes',
                  method: 'update'
                },
                // requests button
                {
                  args: [
                    {
                      x: [data.results.map(result => result.date)],
                      y: [data.results.map(result => result.nb_successful_reqs), data.results.map(result => result.nb_reqs - result.nb_successful_reqs)],
                      name: ["Successful Requests", "Unsuccessful Requests"],
                      type: 'bar'
                    },
                    {
                      barmode: 'stack',
                      title: 'Number of requests per '+details,
                      yaxis: {
                        title: 'Requests'
                      },
                      showlegend: true
                    }
                  ],
                  label: 'Requests',
                  method: 'update'
                }
              ],
              direction: 'down',
              type: 'buttons'
            }]
          };
          if (details === "year") {
            barLayout.xaxis["dtick"] = 1;
          }
          else if (details === "month") {
            barLayout.xaxis["dtick"] = "M1";
          }
          Plotly.newPlot(details+'-plots', barData, barLayout, {displaylogo: false});
        })
        .catch((error) => console.log(error));
    }

    function mapPlots() {
      const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&details=country&format=json`;
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          // convert ISO-2 to ISO-3 country codes
          const iso2ToIso3 = require('country-iso-2-to-3');
          const countryCodesISO3 = data.results.map(result => result.country).map(code => iso2ToIso3(code));

          // show clients at first
          const mapData = [{
            locationmode: 'ISO-3',
            locations: countryCodesISO3,
            z: data.results.map(result => result.clients),
            type: 'choroplethmapbox',
            geojson: new URL('./world-countries.json', import.meta.url).href,
            colorscale: 'Viridis',
            autocolorscale: false,
            reversescale: true
          }];
          const mapLayout = {
            title: 'Number of unique users per country',
            width: 1000,
            mapbox: {
              style: "open-street-map",
              center: {lon: 0, lat: 20},
              zoom: 0
            },
            updatemenus: [{
              buttons: [
                // clients button
                {
                  args: [
                    {
                      z: [data.results.map(result => result.clients)],
                      type: 'choroplethmapbox',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of unique users per country',
                    }
                  ],
                  label: 'Unique Users',
                  method: 'update'
                },
                // bytes button
                {
                  args: [
                    {
                      z: [data.results.map(result => result.bytes)],
                      type: 'choroplethmapbox',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of bytes per country',
                    }
                  ],
                  label: 'Bytes',
                  method: 'update'
                },
                // total requests button
                {
                  args: [
                    {
                      z: [data.results.map(result => result.nb_reqs)],
                      type: 'choroplethmapbox',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of unique users per country',
                    }
                  ],
                  label: 'Total Requests',
                  method: 'update'
                },
                // successful requests button
                {
                  args: [
                    {
                      z: [data.results.map(result => result.nb_successful_reqs)],
                      type: 'choroplethmapbox',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of successful requests per country',
                    }
                  ],
                  label: 'Successful Requests',
                  method: 'update'
                },
                // unsuccessful requests button
                {
                  args: [
                    {
                      z: [data.results.map(result => result.nb_reqs - result.nb_successful_reqs)],
                      type: 'choroplethmapbox',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of unsuccessful requests per country',
                    }
                  ],
                  label: 'Unsuccessful Requests',
                  method: 'update'
                }
              ],
              direction: 'down',
              type: 'buttons'
            }]
          };
          Plotly.newPlot('country-plots', mapData, mapLayout, {displaylogo: false});
        })
        .catch((error) => console.log(error));
    }
}
