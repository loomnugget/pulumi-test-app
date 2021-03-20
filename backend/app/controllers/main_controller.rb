class MainController < ActionController::API

  def index
    render json: { message: "HELLO WORLD" }, status: :ok
  end
end
