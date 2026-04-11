@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup batch script
@REM ----------------------------------------------------------------------------
@IF "%__MVNW_ARG0_NAME__%"=="" (SET __MVNW_ARG0_NAME__=%~nx0)
@SET __ MVNW_CMD__=%MAVEN_PROJECTBASEDIR%
@SET MAVEN_PROJECTBASEDIR=%~dp0
@IF NOT "%MAVEN_PROJECTBASEDIR:~-1%"=="\" (SET MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR%\)

@SET WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar
@SET WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain
@SET WRAPPER_URL=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar

@IF NOT EXIST "%WRAPPER_JAR%" (
  @IF NOT "%MVNW_VERBOSE%"=="" (ECHO Downloading: %WRAPPER_URL%)
  @powershell -Command "$webclient = new-object System.Net.WebClient; $webclient.DownloadFile('%WRAPPER_URL%', '%WRAPPER_JAR%')"
)

@IF "%MVNW_VERBOSE%"=="" (
  @java -cp "%WRAPPER_JAR%" %WRAPPER_LAUNCHER% %MAVEN_CONFIG% %*
) ELSE (
  @ECHO JAVA: %JAVA_HOME%\bin\java.exe
  @java -cp "%WRAPPER_JAR%" %WRAPPER_LAUNCHER% %MAVEN_CONFIG% %*
)
