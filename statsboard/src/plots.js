import Plotly from 'plotly.js-dist';

export function makePlots(startTime, endTime) {

  totalPlots();
  monthAndYearPlots("month");
  monthAndYearPlots("year");
  mapPlots();

  function totalPlots() {
    const url = `/api?start=${startTime}${endTime ? `&end=${endTime}` : ''}&format=json`;
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
          title: "Total number of clients"
        };
        Plotly.newPlot("clients", indicatorDataClients, indicatorLayoutClients, {displaylogo: false});

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
        Plotly.newPlot("bytes", indicatorDataBytes, indicatorLayoutBytes, {displaylogo: false});

        // requests plot
        const pieDataRequests = [
          {
            values: [data.results[0].nb_successful_reqs, data.results[0].nb_reqs - data.results[0].nb_successful_reqs],
            labels: ["Successful Requests", "Failed Requests"],
            type: "pie",
          },
        ];
        const pieLayoutRequests = {
          title: "Total numbers of successful and unsuccessful requests"
        };
        Plotly.newPlot("pie-chart", pieDataRequests, pieLayoutRequests, {displaylogo: false});
      })
      .catch((error) => console.log(error));
    }

    function monthAndYearPlots(details = "month") {
      let url = null;
      if (details === "year") {
        url = `/api?start=${startTime}${endTime ? `&end=${endTime}` : ''}&details=year&format=json`;
      }
      else {
        url = `/api?start=${startTime}${endTime ? `&end=${endTime}` : ''}&details=month&format=json`;
      }
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          // clients per month plot
          const barDataClients = [{
            x: data.results.map(result => result.date),
            y: data.results.map(result => result.clients),
            type: 'bar'
          }];
          let barLayoutClients = {
            title: 'Number of clients per '+details,
            xaxis: {
              title: details.charAt(0).toUpperCase() + details.slice(1)
            },
            yaxis: {
              title: 'Clients'
            }
          };
          if (details === "year") {
            barLayoutClients.xaxis["tickmode"] = "linear";
            barLayoutClients.xaxis["dtick"] = 1;
          }
          Plotly.newPlot('clients-'+details, barDataClients, barLayoutClients, {displaylogo: false});

          // bytes per month plot
          const barDataBytes = [{
            x: data.results.map(result => result.date),
            y: data.results.map(result => result.bytes),
            type: 'bar'
          }];
          let barLayoutBytes = {
            title: 'Number of bytes per '+details,
            xaxis: {
              title: details.charAt(0).toUpperCase() + details.slice(1)
            },
            yaxis: {
              title: 'Bytes'
            }
          };
          if (details === "year") {
            barLayoutBytes.xaxis["tickmode"] = "linear";
            barLayoutBytes.xaxis["dtick"] = 1;
          }
          Plotly.newPlot('bytes-'+details, barDataBytes, barLayoutBytes, {displaylogo: false});

          // requests per month plot
          const barDataRequests = [
            {
              x: data.results.map(result => result.date),
              y: data.results.map(result => result.nb_successful_reqs),
              name: "Successful Requests",
              type: 'bar'
            },
            {
              x: data.results.map(result => result.date),
              y: data.results.map(result => result.nb_reqs - result.nb_successful_reqs),
              name: "Unsuccessful Requests",
              type: 'bar'
            }
          ];
          let barLayoutRequests = {
            barmode: "stack",
            title: 'Number of successful and unsuccessful requests per '+details,
            xaxis: {
              title: details.charAt(0).toUpperCase() + details.slice(1)
            },
            yaxis: {
              title: 'Requests'
            }
          };
          if (details === "year") {
            barLayoutRequests.xaxis["tickmode"] = "linear";
            barLayoutRequests.xaxis["dtick"] = 1;
          }
          Plotly.newPlot('requests-'+details, barDataRequests, barLayoutRequests, {displaylogo: false});
        })
        .catch((error) => console.log(error));
    }

    function mapPlots() {
      const url = `/api?start=${startTime}${endTime ? `&end=${endTime}` : ''}&details=country&format=json`;
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          // convert ISO-2 to ISO-3 country codes
          const iso2ToIso3 = require('country-iso-2-to-3');
          const countryCodesISO3 = data.results.map(result => result.country).map(code => iso2ToIso3(code));

          // clients per country plot
          const mapDataClients = [{
            locationmode: 'ISO-3',
            locations: countryCodesISO3,
            z: data.results.map(result => result.clients),
            type: 'choropleth',
            colorscale: 'Viridis',
            autocolorscale: false,
            reversescale: true
          }];
          const mapLayoutClients = {
            title: 'Number of clients per country',
            geo: {
              projection: {
                type: 'natural earth'
              }
            }
          };
          Plotly.newPlot('clients-country', mapDataClients, mapLayoutClients, {displaylogo: false});

          // bytes per country plot
          const mapDataBytes = [{
            locationmode: 'ISO-3',
            locations: countryCodesISO3,
            z: data.results.map(result => result.bytes),
            type: 'choropleth',
            colorscale: 'Viridis',
            autocolorscale: false,
            reversescale: true
          }];
          const mapLayoutBytes = {
            title: 'Number of bytes per country',
            geo: {
              projection: {
                type: 'natural earth'
              }
            }
          };
          Plotly.newPlot('bytes-country', mapDataBytes, mapLayoutBytes, {displaylogo: false});

          // requests per country plot
          const mapDataRequests = [{
              locationmode: 'ISO-3',
              locations: countryCodesISO3,
              z: data.results.map(result => result.nb_reqs),
              type: 'choropleth',
              colorscale: 'Viridis',
              autocolorscale: false,
              reversescale: true
          }];
          const mapLayoutRequests = {
            title: 'Number of requests per country',
            geo: {
              projection: {
                type: 'natural earth'
              }
            },
            updatemenus: [{
              buttons: [
                {
                  args: [{
                    'z': [data.results.map(result => result.nb_reqs)],
                    'type': 'choropleth',
                    'colorscale': 'Viridis',
                    'autocolorscale': false,
                    'reversescale': true,
                  }],
                  label: 'Total Requests',
                  method: 'update'
                },
                {
                  args: [{
                    'z': [data.results.map(result => result.nb_successful_reqs)],
                    'type': 'choropleth',
                    'colorscale': 'Viridis',
                    'autocolorscale': false,
                    'reversescale': true,
                  }],
                  label: 'Successful Requests',
                  method: 'update'
                },
                {
                  args: [{
                    'z': [data.results.map(result => result.nb_reqs - result.nb_successful_reqs)],
                    'type': 'choropleth',
                    'colorscale': 'Viridis',
                    'autocolorscale': false,
                    'reversescale': true,
                  }],
                  label: 'Unsuccessful Requests',
                  method: 'update'
                }
              ],
              direction: 'down',
              type: 'buttons'
            }]
          };
          Plotly.newPlot('requests-country', mapDataRequests, mapLayoutRequests, {displaylogo: false});
        })
        .catch((error) => console.log(error));
    }
}
