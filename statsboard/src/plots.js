import Plotly from 'plotly.js-dist';

export function makePlots(startTime, endTime) {

  totalPlots();
  monthPlots();

  function totalPlots() {
    const url = `/api?start=${startTime}&end=${endTime}&format=json`;
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

    function monthPlots() {
      const url = `/api?start=${startTime}&end=${endTime}&details=month&format=json`;
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          // clients per month plot
          const barDataClientsMonthly = [{
            x: data.results.map(result => result.date),
            y: data.results.map(result => result.clients),
            type: 'bar'
          }];
          const barLayoutClientsMonthly = {
            title: 'Number of clients per month',
            xaxis: {
              title: 'Month'
            },
            yaxis: {
              title: 'Clients'
            }
          };
          Plotly.newPlot('clients-monthly', barDataClientsMonthly, barLayoutClientsMonthly, {displaylogo: false});
        })
        .catch((error) => console.log(error));
    }
}
