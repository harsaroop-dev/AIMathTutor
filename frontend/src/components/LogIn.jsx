import React from 'react'
import GoogleIcon from '../assets/google.svg'
import ShowPasswordIcon from '../assets/show-password.svg'
import HidePasswordIcon from '../assets/hide-password.svg'
import { useState } from 'react'
// import '../App.css'

const LogIn = () => {

  const [isRegistered, setIsRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function formSubmit(FormData) {
    const email = FormData.get("email")
    const password = FormData.get("password")
    console.log(email, password)
    console.log("hello")
  }

  return (
    <div className='loginBox'>
      <h1>{isRegistered ? 'Login' : 'Register'}</h1>
      <h3>{isRegistered ? 'Hi, Welcome back' : "Create your account"}</h3>

      <button className='googleBtn'><img src={GoogleIcon} alt='google icon' className='googleIcon' />{isRegistered ? 'Login with Google' : 'Register with Google'}</button>
      <h3>or</h3>
      <form action={formSubmit}>
        <label>
          Email
        </label>
        <input name='email' type='email'></input> 
        <label>Password</label>
        <div className="passwordWrapper">
          <input type={showPassword ? "text" : "password"} name='password' />
          <img src={showPassword ? ShowPasswordIcon : HidePasswordIcon} className="passwordIcon" onClick={()=>{setShowPassword(!showPassword)}}/>
        </div>


      <button>{isRegistered ? 'Login' : 'Register'}</button>
      </form>
      
      <h3>{isRegistered ? 'Not registered yet?' : 'Already have an account?'} <a href='#' onClick={
        (e) => {
          e.preventDefault();
          setIsRegistered(!isRegistered)
        }
      }>{isRegistered ? 'Create an account' : 'Login'}</a></h3>
    </div>
  )
}

export default LogIn
