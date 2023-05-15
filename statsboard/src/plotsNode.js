import Plotly from 'plotly.js-dist';

export function makePlotsNode(startTime, endTime) {

  totalPlots();
  monthAndYearPlots("month");
  monthAndYearPlots("year");
  mapPlots();

  function totalPlots() {
    const url = `/api/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&level=node&format=json`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        // clients plot
        const pieDataClients = {
          values: data.results.map(result => result.clients),
          labels: data.results.map(result => result.node),
          type: 'pie'
        };
        const pieLayoutClients = {
          title: 'Total number of unique users'
        };
        Plotly.newPlot('total-clients', [pieDataClients], pieLayoutClients, {displaylogo: false});

        // bytes plot
        const pieDataBytes = {
          values: data.results.map(result => result.bytes),
          labels: data.results.map(result => result.node),
          type: 'pie'
        };
        const pieLayoutBytes = {
          title: 'Total number of bytes'
        };
        Plotly.newPlot('total-bytes', [pieDataBytes], pieLayoutBytes, {displaylogo: false});

        // requests plot
        // show total requests at first
        const pieDataRequests = {
          values: data.results.map(result => result.nb_reqs),
          labels: data.results.map(result => result.node),
          type: 'pie',
          sort: false
        };
        const pieLayoutRequests = {
          title: 'Total number of requests',
          updatemenus: [{
            buttons: [
              // total requests button
              {
                args: [
                  {
                    values: [data.results.map(result => result.nb_reqs)],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of requests',
                  }
                ],
                label: 'Total Requests',
                method: 'update'
              },
              // successful requests button
              {
                args: [
                  {
                    values: [data.results.map(result => result.nb_successful_reqs)],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of successful requests',
                  }
                ],
                label: 'Successful Requests',
                method: 'update'
              },
              // unsuccessful requests button
              {
                args: [
                  {
                    values: [data.results.map(result => result.nb_reqs - result.nb_successful_reqs)],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of unsuccessful requests',
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
        Plotly.newPlot('total-requests', [pieDataRequests], pieLayoutRequests, {displaylogo: false});
      })
      .catch((error) => console.log(error));
    }

    function monthAndYearPlots(details = "month") {
      let url = null;
      if (details === "year") {
        url = `/api/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&level=node&details=year&format=json`;
      }
      else {
        url = `/api/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&level=node&details=month&format=json`;
      }
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          // show clients at first
          const nodes = [...new Set(data.results.map(result => result.node))];
          const barData = nodes.map(node => {
              const nodeResults = data.results.filter(result => result.node === node);
              return {
                x: nodeResults.map(result => result.date),
                y: nodeResults.map(result => result.clients),
                name: node,
                type: 'bar'
              }
          });
          const barDataBytes = nodes.map(node => {
              const nodeResults = data.results.filter(result => result.node === node);
              return {
                x: nodeResults.map(result => result.date),
                y: nodeResults.map(result => result.bytes),
                name: node,
                type: 'bar'
              }
          });
          let barLayout = {
            barmode: 'stack',
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
                      x: barData.map(bar => bar.x),
                      y: barData.map(bar => bar.y),
                      name: nodes,
                      type: 'bar'
                    },
                    {
                      title: 'Number of unique users per '+details,
                      yaxis: {
                        title: 'Unique users'
                      }
                    }
                  ],
                  label: 'Clients',
                  method: 'update'
                },
                // bytes button
                {
                  args: [
                    {
                      x: barDataBytes.map(bar => bar.x),
                      y: barDataBytes.map(bar => bar.y),
                      name: nodes,
                      type: 'bar'
                    },
                    {
                      title: 'Number of bytes per '+details,
                      yaxis: {
                        title: 'Bytes'
                      }
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
                      }
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
      const url = `/api/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&details=country&format=json`;
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
            type: 'choropleth',
            colorscale: 'Viridis',
            autocolorscale: false,
            reversescale: true
          }];
          const mapLayout = {
            title: 'Number of unique users per country',
            geo: {
              projection: {
                type: 'natural earth'
              }
            },
            updatemenus: [{
              buttons: [
                // clients button
                {
                  args: [
                    {
                      z: [data.results.map(result => result.clients)],
                      type: 'choropleth',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of unique users per country',
                    }
                  ],
                  label: 'Clients',
                  method: 'update'
                },
                // bytes button
                {
                  args: [
                    {
                      z: [data.results.map(result => result.bytes)],
                      type: 'choropleth',
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
                      type: 'choropleth',
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
                      type: 'choropleth',
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
                      type: 'choropleth',
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
