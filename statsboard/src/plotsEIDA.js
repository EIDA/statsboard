import Plotly from 'plotly.js-dist';

export function makePlotsEIDA(startTime, endTime) {

  // show message while loading
  let loadingMsg = document.getElementById("loading-msg");
  loadingMsg.innerHTML = "Loading plots. Please wait...";
  function flashLoadingMessage() {
    if (loadingMsg.innerHTML === "Loading plots. Please wait...") {
      loadingMsg.innerHTML = "Loading plots. Please wait";
    } else {
      loadingMsg.innerHTML += ".";
    }
  }
  const intervalId = setInterval(flashLoadingMessage, 500);

  totalPlots();
  monthAndYearPlots("month");
  let endYear = new Date().getFullYear();
  if (endTime) {
    endYear = endTime.split('-')[0];
  }
  if (startTime.split('-')[0] != endYear) {
    monthAndYearPlots("year");
  }
  mapPlots();

  function totalPlots() {
    const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&format=json`;
    fetch(url)
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        else {
          response.text().then(errorMessage => {
            if (errorMessage.includes('Internal') || errorMessage.includes('Time-out')) {
              let totalplots = document.getElementById('error-total');
              totalplots.innerHTML = "Service is temporarily unavailable. Please try again.";
            }
            else if (response.status >= 400 && response.status < 500) {
              let totalplots = document.getElementById('error-total');
              totalplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
            }
          });
          throw Error(response.statusText);
        }
      })
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
          title: "Total number of unique users",
          annotations: [
            {
              xshift: -20,
              y: -0.25,
              xref: 'paper',
              yref: 'paper',
              text: '*<i>Important note: Unique users are estimated based on<br>anonymised distinct IP addresses of the clients issuing requests.<\i>',
              showarrow: false,
              font: {
                family: 'Arial',
                size: 12,
                color: 'black'
              }
            }
          ],
        };
        Plotly.newPlot("total-clients", indicatorDataClients, indicatorLayoutClients, {displaylogo: false});

        // bytes plot
        const indicatorDataBytes = [
          {
            type: "indicator",
            value: data.results[0].bytes,
            mode: "number",
            number: { font: { size: 50 }, valueformat: '.3s' }
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
            hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>'
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
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          else {
            response.text().then(errorMessage => {
              if (errorMessage.includes('Internal') || errorMessage.includes('Time-out')) {
                if (details === "month") {
                  let monthplots = document.getElementById('error-month');
                  monthplots.innerHTML = "Service is temporarily unavailable. Please try again.";
                }
                else {
                  let yearplots = document.getElementById('error-year');
                  yearplots.innerHTML = "Service is temporarily unavailable. Please try again.";
                }
              }
              else if (response.status >= 400 && response.status < 500) {
                if (details === "month") {
                  let monthplots = document.getElementById('error-month');
                  monthplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
                }
                else {
                  let yearplots = document.getElementById('error-year');
                  yearplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
                }
              }
            });
            throw Error(response.statusText);
          }
        })
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
            annotations: [
              {
                y: -0.30,
                yref: 'paper',
                xref: 'paper',
                text: `<i>The above plot shows the number of unique users of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>`,
                showarrow: false,
                font: {
                  family: 'Arial',
                  size: 12,
                  color: 'black'
                }
              }
            ],
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
                      annotations: [
                        {
                          y: -0.30,
                          yref: 'paper',
                          xref: 'paper',
                          text: `<i>The above plot shows the number of unique users of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>`,
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
                      annotations: [
                        {
                          y: -0.27,
                          yref: 'paper',
                          xref: 'paper',
                          text: `<i>The above plot shows the amount of data delivered during the use of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<\i>`,
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
                      annotations: [
                        {
                          y: -0.27,
                          yref: 'paper',
                          xref: 'paper',
                          text: `<i>The above plot shows the number of requests made to the EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<\i>`,
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
          let config = {
            displaylogo: false,
            modeBarButtonsToRemove: ['select2d','lasso2d','autoScale2d']
          }
          Plotly.newPlot(details+'-plots', barData, barLayout, config);
        })
        .catch((error) => console.log(error));
    }

    function mapPlots() {
      const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&details=country&format=json`;
      fetch(url)
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          else {
            response.text().then(errorMessage => {
              if (errorMessage.includes('Internal') || errorMessage.includes('Time-out')) {
                let mapplots = document.getElementById('error-map');
                mapplots.innerHTML = "Service is temporarily unavailable. Please try again.";
              }
              else if (response.status >= 400 && response.status < 500) {
                let mapplots = document.getElementById('error-map');
                mapplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
              }
            });
            throw Error(response.statusText);
          }
        })
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
            annotations: [
              {
                y: -0.15,
                yref: 'paper',
                xref: 'paper',
                text: '<i>The above plot shows the number of unique users of EIDA services from each country.<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>',
                showarrow: false,
                font: {
                  family: 'Arial',
                  size: 12,
                  color: 'black'
                }
              }
            ],
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of unique users of EIDA services from each country.<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the amount of data delivered to users of EIDA services from each country.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of total requests made to the EIDA services from each country.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of successful requests made to the EIDA services from each country.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of unsuccesssful requests (i.e. requests that did not return any data) made to the EIDA services from each country.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
          let config = {
            displaylogo: false,
            modeBarButtonsToRemove: ['select2d','lasso2d','autoScale2d']
          }
          Plotly.newPlot('country-plots', mapData, mapLayout, config);
          const mapAndBoxes = document.getElementById('mapAndBoxes');
          mapAndBoxes.style.backgroundColor = 'white';
        })
        .catch((error) => console.log(error))
        .finally(() => {
          // remove loading message
          clearInterval(intervalId);
          loadingMsg.innerHTML = "";
        });
    }
}
