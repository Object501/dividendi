final: prev:

{
  pythonPackagesExtensions = prev.pythonPackagesExtensions ++ [
    (python-final: _python-prev: {
      baostock = python-final.buildPythonPackage rec {
        pname = "baostock";
        version = "0.9.3";
        pyproject = true;

        src = final.fetchPypi {
          inherit pname version;
          hash = "sha256-FmmdgtBQN6jBM1d/zeuawNWn8x7cJDLE6IMATgqV4/c=";
        };

        build-system = [ python-final.setuptools ];
        dependencies = [ python-final.pandas ];
        pythonImportsCheck = [ "baostock" ];

        meta = {
          description = "Historical data client for China's stock market";
          homepage = "https://baostock.com";
          license = final.lib.licenses.bsd3;
        };
      };

      pyluach = python-final.buildPythonPackage rec {
        pname = "pyluach";
        version = "2.3.0";
        pyproject = true;

        src = final.fetchPypi {
          inherit pname version;
          hash = "sha256-7G4wZp0d9QycoWBIbaRKgZW7THpdPVM5kNDFsDrM0oE=";
        };

        build-system = [ python-final.flit-core ];
        pythonImportsCheck = [ "pyluach" ];

        meta = {
          description = "Hebrew calendar conversion library";
          homepage = "https://github.com/simlist/pyluach";
          license = final.lib.licenses.mit;
        };
      };

      exchange-calendars = python-final.buildPythonPackage rec {
        pname = "exchange_calendars";
        version = "4.13.2";
        pyproject = true;

        src = final.fetchPypi {
          inherit pname version;
          hash = "sha256-qUWUJd1kFCzVT7xjmEdAPH4MM9YPvDJslPwda9En8AI=";
        };

        build-system = with python-final; [
          setuptools
          setuptools-scm
          wheel
        ];
        dependencies = with python-final; [
          korean-lunar-calendar
          numpy
          pandas
          pyluach
          toolz
          tzdata
        ];
        pythonImportsCheck = [ "exchange_calendars" ];

        meta = {
          description = "Calendars for securities exchanges";
          homepage = "https://github.com/gerrymanoim/exchange_calendars";
          license = final.lib.licenses.asl20;
        };
      };

      pandas-market-calendars = python-final.buildPythonPackage rec {
        pname = "pandas_market_calendars";
        version = "5.4.0";
        pyproject = true;

        src = final.fetchPypi {
          inherit pname version;
          hash = "sha256-sC86DpvLS56CpQYL8mDvAGDM05j5ibXm+CCPQ1KWeAY=";
        };

        build-system = [ python-final.setuptools ];
        dependencies = with python-final; [
          exchange-calendars
          pandas
        ];
        pythonImportsCheck = [ "pandas_market_calendars" ];

        meta = {
          description = "Market and exchange trading calendars for pandas";
          homepage = "https://github.com/rsheftel/pandas_market_calendars";
          license = final.lib.licenses.mit;
        };
      };
    })
  ];

  dividendi-python = final.python3.withPackages (python: [
    python.baostock
    python.cryptography
    python.jsonschema
    python.pandas-market-calendars
  ]);
}
