use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("base de datos bloqueada")]
    Locked,
    #[error("contraseña incorrecta")]
    WrongPassword,
    #[error("no encontrado: {0}")]
    NotFound(String),
    #[error("error de base de datos: {0}")]
    Db(String),
    #[error("error de IO: {0}")]
    Io(String),
    #[error("error interno: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 2)?;
        let code = match self {
            AppError::Locked        => "Locked",
            AppError::WrongPassword => "WrongPassword",
            AppError::NotFound(_)   => "NotFound",
            AppError::Db(_)         => "Db",
            AppError::Io(_)         => "Io",
            AppError::Internal(_)   => "Internal",
        };
        s.serialize_field("code", code)?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self { AppError::Db(e.to_string()) }
}
impl From<r2d2::Error> for AppError {
    fn from(e: r2d2::Error) -> Self { AppError::Db(e.to_string()) }
}
impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self { AppError::Io(e.to_string()) }
}
impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self { AppError::Internal(e.to_string()) }
}
