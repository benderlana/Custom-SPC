sap.ui.define([
    'jquery.sap.global',
    'sap/ui/model/json/JSONModel',
    'sap/ui/core/mvc/Controller'
], function (jQuery, JSONModel, Controller) {
    "use strict";

    var MainController = Controller.extend("myapp.controller.Main", {

        ModelPlot: new JSONModel({}),
        ModelTiles: new JSONModel({}),
        ID: null,
        index: null,
        Sampling: null,
        Alarm: null,
        SPCDialog: null,
        MsecRefresh: 2000,

        onInit: function () {
            this.RefreshCall();
        },
        AjaxCallerData: function (addressOfJSON, successFunc, errorFunc) {
            jQuery.ajax({
                url: addressOfJSON,
                method: "GET",
                dataType: "json",
                async: false,
                success: successFunc,
                error: errorFunc
            });
        },
        AjaxCallerVoid: function (address, Func) {
            var req = jQuery.ajax({
                url: address,
                async: false
            });
            req.always(Func);
        },
        RefreshFunction: function () {
            this.TIMER = setTimeout(this.RefreshCall.bind(this), this.MsecRefresh);
        },
        RefreshCall: function () {
            var link = "/XMII/Runner?Transaction=DeCecco/SPC/Transactions/GetValuesTiles&Content-Type=text/json&OutputParameter=JSON";
            this.AjaxCallerData(link, this.SUCCESSValueTiles.bind(this));
        },
        SUCCESSValueTiles: function (Jdata) {
            if (this.getView().byId("container").getContent().length === Jdata.length) {
                for (var i in Jdata) {
                    if (Jdata[i].alarm === "1") {
                        this.getView().byId("container").getContent()[i].getTileContent()[0].getContent().setState("Loaded");
                    } else {
                        this.getView().byId("container").getContent()[i].getTileContent()[0].getContent().setState("Disabled");
                    }
                    if (isNaN(Jdata[i].value) || Jdata[i].value === "0.0") {
                        Jdata[i].value = "SMPL";
                    }
                }
            }
            this.ModelTiles.setData(Jdata);
//            for (var i in obj) {
//                if (isNaN(obj[i])) {
//                    obj[i] = "SMPL";
//                }
//            }
//            for (var j in Jdata) {
//                if (Jdata[j].alarm === "1") {
//                    this.getView().byId(String(Number(j) + 1) + "NC").setState("Loaded");
//                } else {
//                    this.getView().byId(String(Number(j) + 1) + "NC").setState("Disabled");
//                }
//            }
//            this.ValuesTiles.setData(obj);
            this.getView().setModel(this.ModelTiles, "ValuesTiles");
            this.RefreshFunction();
        },
        //      RICHIAMATO DAL PULSANTONE VERDE A FIANCO DELLA PROGRESS BAR
        SPCGraph: function (event) {
//            var StringIndex = event.getParameter("id")[event.getParameter("id").length - 1];
//            this.index = Number(StringIndex) - 1;
            var StringIndex = event.getSource().getId().split("-");
            this.index = Number(StringIndex[StringIndex.length - 1]);
            this.ID = this.ModelTiles.getData()[this.index].ID;
            this.Alarm = this.ModelTiles.getData()[this.index].alarm;
            this.Sampling = this.ModelTiles.getData()[this.index].sampleProgress;
            this.SPCDialog = this.getView().byId("SPCWindow");
            if (!this.SPCDialog) {
                this.SPCDialog = sap.ui.xmlfragment(this.getView().getId(), "myapp.view.SPCWindow", this);
                this.getView().addDependent(this.SPCDialog);
            }
            this.SPCDialog.open();
            this.SPCDataCaller();
        },
        SPCDataCaller: function () {
            if (this.SPCDialog) {
                if (this.SPCDialog.isOpen()) {
                    var link = "/XMII/Runner?Transaction=DeCecco/SPC/Transactions/SPCGetDataForPlot&Content-Type=text/json&OutputParameter=JSON&IDParameter=" + this.ID;
                    this.AjaxCallerData(link, this.SUCCESSSPCDataLoad.bind(this));
                }
            }
        },
        SUCCESSSPCDataLoad: function (Jdata) {
            var isEmpty;
            if (Jdata.values === "") {
                isEmpty = 1;
            } else {
                isEmpty = 0;
                Jdata = this.ParseSPCData(Jdata, "#");
                this.ModelPlot.setData(Jdata);
                this.getView().setModel(this.ModelPlot, "ModelPlot");
            }
            this.SPCDialogFiller(isEmpty);
            setTimeout(this.SPCDataCaller.bind(this), this.MsecRefresh);
        },
        SPCDialogFiller: function (discr) {
            var textHeader = this.getView().byId("headerSPCWindow");
            textHeader.setText(String(this.ModelTiles.getData()[this.index].description));
            var samplingHeader = this.getView().byId("samplingSPC");
            if (discr === 1) {
                samplingHeader.setText("Sampling: " + String(this.Sampling) + "/50");
            } else {
                samplingHeader.setText("");
            }
            if (discr !== 1) {
                var plotBox = this.getView().byId("plotBox");
                var alarmButton = this.getView().byId("alarmButton");
                if (Number(this.Alarm) === 1) {
                    alarmButton.setEnabled(true);
                    alarmButton.removeStyleClass("chiudiButton");
                    alarmButton.addStyleClass("allarmeButton");
                } else {
                    alarmButton.setEnabled(false);
                    alarmButton.removeStyleClass("allarmeButton");
                    alarmButton.addStyleClass("chiudiButton");
                }
                var data = this.ModelPlot.getData();
                var result = this.PrepareDataToPlot(data);
                var ID = jQuery.sap.byId(plotBox.getId()).get(0);
                Plotly.newPlot(ID, result.dataPlot, result.layout);
            }
        },
        RemoveAlarm: function () {
            var alarmButton = this.getView().byId("alarmButton");
            alarmButton.setEnabled(false);
            alarmButton.removeStyleClass("allarmeButton");
            alarmButton.addStyleClass("chiudiButton");
            var link = "/XMII/Runner?Transaction=DeCecco/SPC/Transactions/ResetSPC&Content-Type=text/json&IDParameter=" + this.ID;
            this.AjaxCallerVoid(link, this.RefreshCall.bind(this));
            this.CloseSPCDialog();
        },
        CloseSPCDialog: function () {
            this.SPCDialog.close();
        },
        ParseSPCData: function (data, char) {
            for (var key in data) {
                data[key] = data[key].split(char);
                for (var i = data[key].length - 1; i >= 0; i--) {
                    if (data[key][i] === "") {
                        data[key].splice(i, 1);
                    } else {
                        if (key !== "time") {
                            data[key][i] = Number(data[key][i]);
                        }
                    }
                }
            }
            return data;
        },
        PrepareDataToPlot: function (Jdata) {
            var dataPlot, layout;
            var values = {
                x: Jdata.time,
                y: Jdata.values,
                type: 'scatter',
                line: {color: 'rgb(0,58,107)', width: 1}
            };
            var limSup = {
                x: Jdata.time,
                y: Jdata.limSup,
                type: 'scatter',
                line: {color: 'rgb(167,25,48)', width: 1}
            };
            var limInf = {
                x: Jdata.time,
                y: Jdata.limInf,
                type: 'scatter',
                line: {color: 'rgb(167,25,48)', width: 1}
            };
            dataPlot = [values, limSup, limInf];
            layout = {
                showlegend: false,
                autosize: true,
                xaxis: {
                    showgrid: true,
                    zeroline: false
                },
                yaxis: {
                    showgrid: true,
                    zeroline: false
                }
            };
            if (Number(this.Alarm) === 0) {
                layout.xaxis.linecolor = "rgb(124,162,149)";
                layout.yaxis.linecolor = "rgb(124,162,149)";
            } else {
                layout.xaxis.linecolor = "rgb(255,211,0)";
                layout.yaxis.linecolor = "rgb(255,211,0)";
            }
            layout.xaxis.linewidth = 4;
            layout.xaxis.mirror = true;
            layout.yaxis.linewidth = 4;
            layout.yaxis.mirror = true;
            return {dataPlot: dataPlot, layout: layout};
        }
    });
    return MainController;
});